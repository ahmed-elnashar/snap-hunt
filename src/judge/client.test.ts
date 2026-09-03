import { askTheJudge, resolveJudgeUrl } from './client';
import { DEVICE_ID_HEADER } from './wire';

const VERDICT = {
  verdict: 'accept',
  confidence: 0.91,
  detected: 'a blue enamel mug',
  reason: 'A blue enamel mug. Round on every axis I can test from here. Admitted.',
};

const base = {
  promptId: 'round-blue-01',
  promptText: 'something round and blue',
  imageBase64: 'x'.repeat(128),
  deviceId: 'device-0123456789',
  baseUrl: 'https://judge.example',
};

function respond(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as unknown as typeof fetch;
}

describe('resolveJudgeUrl', () => {
  it('appends the route', () => {
    expect(resolveJudgeUrl('https://judge.example')).toBe(
      'https://judge.example/api/judge',
    );
  });

  it('tolerates a trailing slash', () => {
    expect(resolveJudgeUrl('https://judge.example///')).toBe(
      'https://judge.example/api/judge',
    );
  });

  it('accepts a LAN dev server over http', () => {
    expect(resolveJudgeUrl('http://192.168.1.10:8082')).toBe(
      'http://192.168.1.10:8082/api/judge',
    );
  });

  it.each([undefined, '', '   ', 'judge.example', 'ftp://judge.example'])(
    'refuses %p rather than building a nonsense URL',
    (value) => {
      expect(resolveJudgeUrl(value)).toBeNull();
    },
  );
});

describe('askTheJudge', () => {
  it('returns the ruling', async () => {
    const result = await askTheJudge({
      ...base,
      fetchImpl: respond({ ok: true, verdict: VERDICT, repaired: false }),
    });
    expect(result).toEqual({ kind: 'verdict', verdict: VERDICT, repaired: false });
  });

  it('sends the device id as a header, never in the body', async () => {
    let seen: RequestInit | undefined;
    const impl = (async (_url: string, init?: RequestInit) => {
      seen = init;
      return new Response(
        JSON.stringify({ ok: true, verdict: VERDICT, repaired: false }),
      );
    }) as unknown as typeof fetch;

    await askTheJudge({ ...base, fetchImpl: impl });
    const headers = seen?.headers as Record<string, string>;
    expect(headers[DEVICE_ID_HEADER]).toBe('device-0123456789');
    expect(String(seen?.body)).not.toContain('device-0123456789');
  });

  it('reports a rate limit distinctly, with the wait', async () => {
    const result = await askTheJudge({
      ...base,
      fetchImpl: respond({ ok: false, error: 'ratelimit', retryAfterSeconds: 1800 }, 429),
    });
    expect(result).toEqual({
      kind: 'failed',
      reason: 'ratelimit',
      retryAfterSeconds: 1800,
    });
  });

  it('handles a rate limit that omits the wait', async () => {
    const result = await askTheJudge({
      ...base,
      fetchImpl: respond({ ok: false, error: 'ratelimit' }, 429),
    });
    expect(result).toEqual({ kind: 'failed', reason: 'ratelimit' });
  });

  it('reports upstream trouble as a network failure', async () => {
    const result = await askTheJudge({
      ...base,
      fetchImpl: respond({ ok: false, error: 'upstream' }, 502),
    });
    expect(result).toMatchObject({ kind: 'failed', reason: 'network' });
  });

  it('validates our own server’s response rather than trusting it', async () => {
    const result = await askTheJudge({
      ...base,
      // A deploy skew: confidence outside the range the app will render.
      fetchImpl: respond({
        ok: true,
        verdict: { ...VERDICT, confidence: 4 },
        repaired: false,
      }),
    });
    expect(result).toMatchObject({ kind: 'failed', reason: 'unparseable' });
  });

  it('reports unparseable when the body is not JSON', async () => {
    const impl = (async () =>
      new Response('<html>gateway</html>')) as unknown as typeof fetch;
    expect(await askTheJudge({ ...base, fetchImpl: impl })).toMatchObject({
      kind: 'failed',
      reason: 'unparseable',
    });
  });

  it('reports a network failure when fetch throws', async () => {
    const impl = (async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await askTheJudge({ ...base, fetchImpl: impl })).toEqual({
      kind: 'failed',
      reason: 'network',
    });
  });

  it('reports a timeout distinctly from a network failure', async () => {
    const impl = (async (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch;

    const result = await askTheJudge({ ...base, fetchImpl: impl, timeoutMs: 10 });
    expect(result).toEqual({ kind: 'failed', reason: 'timeout' });
  });

  it('aborts the request rather than only giving up on it', async () => {
    let aborted = false;
    const impl = (async (_url: string, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('aborted'));
        });
      })) as unknown as typeof fetch;

    await askTheJudge({ ...base, fetchImpl: impl, timeoutMs: 10 });
    expect(aborted).toBe(true);
  });

  it('fails rather than calling a nonsense URL when the app is misconfigured', async () => {
    const impl = (() => {
      throw new Error('should not be called');
    }) as unknown as typeof fetch;
    expect(await askTheJudge({ ...base, baseUrl: undefined, fetchImpl: impl })).toEqual({
      kind: 'failed',
      reason: 'network',
    });
  });
});
