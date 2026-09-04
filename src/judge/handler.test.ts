import { type JudgeOutcome } from './anthropic';
import { createJudgeHandler } from './handler';
import { createRateLimiter } from './rateLimit';
import { type Verdict } from './schema';
import { DEVICE_ID_HEADER, JudgeResponseSchema, MAX_REQUEST_BYTES } from './wire';

const VERDICT: Verdict = {
  verdict: 'accept',
  confidence: 0.91,
  detected: 'a blue enamel mug',
  reason: 'A blue enamel mug. Round on every axis I can test from here. Admitted.',
};

const IMAGE = 'x'.repeat(256);

function body(over: Record<string, unknown> = {}) {
  return JSON.stringify({
    promptId: 'round-blue-01',
    promptText: 'something round and blue',
    imageBase64: IMAGE,
    ...over,
  });
}

function post(init: { device?: string | null; raw?: string } = {}): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (init.device !== null) {
    headers.set(DEVICE_ID_HEADER, init.device ?? 'device-0123456789');
  }
  return new Request('https://judge.example/api/judge', {
    method: 'POST',
    headers,
    body: init.raw ?? body(),
  });
}

function build(over: Partial<Parameters<typeof createJudgeHandler>[0]> = {}) {
  const rule = jest.fn(async (): Promise<JudgeOutcome> => ({
    ok: true,
    verdict: VERDICT,
    repaired: false,
  }));
  const handle = createJudgeHandler({
    apiKey: 'sk-ant-test-key',
    limiter: createRateLimiter({ limit: 3, windowMs: 3_600_000 }),
    rule,
    ...over,
  });
  return { handle, rule };
}

describe('the judge route', () => {
  it('returns a schema-valid ruling', async () => {
    const { handle } = build();
    const response = await handle(post());
    expect(response.status).toBe(200);
    const parsed = JudgeResponseSchema.safeParse(await response.json());
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.ok && parsed.data.verdict).toEqual(VERDICT);
  });

  it('forbids caching a ruling', async () => {
    const { handle } = build();
    const response = await handle(post());
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('passes the prompt and image through, and nothing else', async () => {
    const { handle, rule } = build();
    await handle(post());
    expect(rule).toHaveBeenCalledWith({
      apiKey: 'sk-ant-test-key',
      promptText: 'something round and blue',
      imageBase64: IMAGE,
    });
  });

  describe('the key', () => {
    it('reports upstream when the server has no key, rather than trying', async () => {
      const { handle, rule } = build({ apiKey: undefined });
      const response = await handle(post());
      expect(response.status).toBe(503);
      expect(rule).not.toHaveBeenCalled();
    });

    it('treats an empty key as missing', async () => {
      const { handle } = build({ apiKey: '' });
      expect((await handle(post())).status).toBe(503);
    });

    it('never appears in any response body or header', async () => {
      const { handle } = build();
      for (const request of [post(), post({ device: null }), post({ raw: 'nonsense' })]) {
        const response = await handle(request);
        const text = await response.text();
        expect(text).not.toContain('sk-ant');
        expect(JSON.stringify([...response.headers])).not.toContain('sk-ant');
      }
    });
  });

  describe('the device id', () => {
    it('rejects a request with no device header', async () => {
      const { handle, rule } = build();
      const response = await handle(post({ device: null }));
      expect(response.status).toBe(400);
      expect(rule).not.toHaveBeenCalled();
    });

    it('rejects a device id too short to be one of ours', async () => {
      const { handle } = build();
      expect((await handle(post({ device: 'abc' }))).status).toBe(400);
    });

    it('rejects an absurdly long device id rather than using it as a map key', async () => {
      const { handle } = build();
      expect((await handle(post({ device: 'd'.repeat(5000) }))).status).toBe(400);
    });
  });

  describe('the rate limit', () => {
    it('serves up to the cap then refuses', async () => {
      const { handle } = build();
      for (let i = 0; i < 3; i += 1) {
        expect((await handle(post())).status).toBe(200);
      }
      expect((await handle(post())).status).toBe(429);
    });

    it('says when to come back, in the body and in the header', async () => {
      const { handle } = build({
        limiter: createRateLimiter({ limit: 1, windowMs: 3_600_000 }),
      });
      await handle(post());
      const response = await handle(post());
      expect(response.status).toBe(429);
      expect(response.headers.get('retry-after')).toBe('3600');
      const parsed = JudgeResponseSchema.parse(await response.json());
      expect(parsed).toMatchObject({ error: 'ratelimit', retryAfterSeconds: 3600 });
    });

    it('does not call the model once the cap is hit', async () => {
      const { handle, rule } = build({
        limiter: createRateLimiter({ limit: 1, windowMs: 3_600_000 }),
      });
      await handle(post());
      await handle(post());
      expect(rule).toHaveBeenCalledTimes(1);
    });

    it('counts before reading the body, so a refused device costs nothing', async () => {
      const { handle } = build({
        limiter: createRateLimiter({ limit: 1, windowMs: 3_600_000 }),
      });
      await handle(post());
      // A malformed body from an over-limit device still gets the rate-limit
      // answer, not a parse error: we never read it.
      const response = await handle(post({ raw: '{{{' }));
      expect(response.status).toBe(429);
    });

    it('does not spend the allowance on a request it refused as malformed', async () => {
      // The limit exists so a device cannot spend the API budget. A malformed
      // request spends none of it, so charging for one would take rounds away
      // from a player for a client bug they cannot see.
      const limiter = createRateLimiter({ limit: 2, windowMs: 3_600_000 });
      const { handle, rule } = build({ limiter });

      expect((await handle(post({ raw: '{{{' }))).status).toBe(400);
      expect((await handle(post({ raw: '{{{' }))).status).toBe(400);
      expect((await handle(post({ raw: body({ promptText: '' }) }))).status).toBe(400);

      // All three were free: both real submissions still go through.
      expect((await handle(post())).status).toBe(200);
      expect((await handle(post())).status).toBe(200);
      expect(rule).toHaveBeenCalledTimes(2);
      expect((await handle(post())).status).toBe(429);
    });
  });

  describe('oversized bodies', () => {
    function oversized(): Request {
      const headers = new Headers({
        'content-type': 'application/json',
        'content-length': String(MAX_REQUEST_BYTES + 1),
        [DEVICE_ID_HEADER]: 'device-0123456789',
      });
      return new Request('https://judge.example/api/judge', {
        method: 'POST',
        headers,
        body: body(),
      });
    }

    it('refuses a declared length over the ceiling without calling the model', async () => {
      const { handle, rule } = build();
      const response = await handle(oversized());
      expect(response.status).toBe(413);
      expect(rule).not.toHaveBeenCalled();
    });

    it('does not spend the allowance on one either', async () => {
      const limiter = createRateLimiter({ limit: 1, windowMs: 3_600_000 });
      const { handle } = build({ limiter });
      await handle(oversized());
      expect((await handle(post())).status).toBe(200);
    });
  });

  describe('bad requests', () => {
    it('rejects a body that is not JSON', async () => {
      const { handle } = build();
      expect((await handle(post({ raw: 'not json' }))).status).toBe(400);
    });

    it('rejects a missing prompt', async () => {
      const { handle } = build();
      const response = await handle(post({ raw: body({ promptText: undefined }) }));
      expect(response.status).toBe(400);
    });

    it('rejects an image far larger than a downscaled photograph', async () => {
      const { handle, rule } = build();
      const response = await handle(
        post({ raw: body({ imageBase64: 'x'.repeat(3_000_000) }) }),
      );
      expect(response.status).toBe(400);
      expect(rule).not.toHaveBeenCalled();
    });

    it('rejects an image too small to be a photograph', async () => {
      const { handle } = build();
      expect((await handle(post({ raw: body({ imageBase64: 'x' }) }))).status).toBe(400);
    });

    it('never echoes the offending value, which can be the photograph', async () => {
      const { handle } = build();
      const response = await handle(post({ raw: body({ promptText: '' }) }));
      const text = await response.text();
      expect(text).not.toContain(IMAGE.slice(0, 32));
    });
  });

  describe('upstream failure', () => {
    it('reports it without detail', async () => {
      const { handle } = build({
        rule: async (): Promise<JudgeOutcome> => ({ ok: false, failure: 'upstream' }),
      });
      const response = await handle(post());
      expect(response.status).toBe(502);
      expect(JudgeResponseSchema.parse(await response.json())).toEqual({
        ok: false,
        error: 'upstream',
      });
    });
  });

  it('answers every path with a body the client can parse', async () => {
    const cases = [
      build(),
      build({ apiKey: undefined }),
      build({
        rule: async (): Promise<JudgeOutcome> => ({ ok: false, failure: 'upstream' }),
      }),
    ];
    for (const { handle } of cases) {
      const response = await handle(post());
      expect(JudgeResponseSchema.safeParse(await response.json()).success).toBe(true);
    }
  });
});
