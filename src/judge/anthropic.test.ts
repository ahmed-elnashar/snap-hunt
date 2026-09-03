import {
  ILLEGIBLE_RULING,
  JUDGE_MODEL,
  VERDICT_JSON_SCHEMA,
  ruleOnPhotograph,
} from './anthropic';

const CLEAN = `{"verdict":"accept","confidence":0.91,"detected":"a blue enamel mug","reason":"A blue enamel mug. Round on every axis I can test from here. Admitted."}`;

function reply(text: string, status = 200): Response {
  return new Response(JSON.stringify({ content: [{ type: 'text', text }] }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fakeFetch(replies: (() => Response | Promise<Response>)[]) {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    const next = replies[calls.length];
    calls.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    if (next === undefined) throw new Error('unexpected extra call');
    return next();
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const base = {
  apiKey: 'sk-ant-test',
  promptText: 'something round and blue',
  imageBase64: 'x'.repeat(128),
};

describe('ruleOnPhotograph', () => {
  it('returns the ruling from a clean response without repairing', async () => {
    const { impl, calls } = fakeFetch([() => reply(CLEAN)]);
    const outcome = await ruleOnPhotograph({ ...base, fetchImpl: impl });
    expect(outcome).toMatchObject({ ok: true, repaired: false });
    if (!outcome.ok) throw new Error('expected a ruling');
    expect(outcome.verdict.detected).toBe('a blue enamel mug');
    expect(calls).toHaveLength(1);
  });

  it('sends the pinned dated model, never a bare alias', async () => {
    const { impl, calls } = fakeFetch([() => reply(CLEAN)]);
    await ruleOnPhotograph({ ...base, fetchImpl: impl });
    expect(calls[0]?.body['model']).toBe(JUDGE_MODEL);
    expect(JUDGE_MODEL).toBe('claude-haiku-4-5-20251001');
  });

  it('asks for structured output and sends no unsupported constraints', async () => {
    const { impl, calls } = fakeFetch([() => reply(CLEAN)]);
    await ruleOnPhotograph({ ...base, fetchImpl: impl });
    expect(calls[0]?.body['output_config']).toEqual({
      format: { type: 'json_schema', schema: VERDICT_JSON_SCHEMA },
    });
    // Structured outputs rejects numeric and string constraints; Zod enforces
    // them instead. A schema carrying them would 400 on every request.
    const serialised = JSON.stringify(VERDICT_JSON_SCHEMA);
    for (const banned of ['minimum', 'maximum', 'minLength', 'maxLength']) {
      expect(serialised).not.toContain(banned);
    }
  });

  it('sends no thinking and no effort, both wrong for a latency-critical judge', async () => {
    const { impl, calls } = fakeFetch([() => reply(CLEAN)]);
    await ruleOnPhotograph({ ...base, fetchImpl: impl });
    expect(calls[0]?.body).not.toHaveProperty('thinking');
    expect(calls[0]?.body['output_config']).not.toHaveProperty('effort');
  });

  it('sends the image before the text, as the API prefers', async () => {
    const { impl, calls } = fakeFetch([() => reply(CLEAN)]);
    await ruleOnPhotograph({ ...base, fetchImpl: impl });
    const messages = calls[0]?.body['messages'] as { content: { type: string }[] }[];
    expect(messages[0]?.content[0]?.type).toBe('image');
    expect(messages[0]?.content[1]?.type).toBe('text');
  });

  it('keeps the system prompt byte-identical across rounds, so it stays cacheable', async () => {
    const a = fakeFetch([() => reply(CLEAN)]);
    const b = fakeFetch([() => reply(CLEAN)]);
    await ruleOnPhotograph({ ...base, fetchImpl: a.impl });
    await ruleOnPhotograph({
      ...base,
      promptText: 'something older than you are',
      fetchImpl: b.impl,
    });
    expect(a.calls[0]?.body['system']).toBe(b.calls[0]?.body['system']);
  });

  it('carries the round prompt in the user turn', async () => {
    const { impl, calls } = fakeFetch([() => reply(CLEAN)]);
    await ruleOnPhotograph({
      ...base,
      promptText: 'something older than you are',
      fetchImpl: impl,
    });
    const messages = calls[0]?.body['messages'] as { content: { text?: string }[] }[];
    expect(messages[0]?.content[1]?.text).toContain('something older than you are');
  });

  it('repairs once when the first response cannot be read', async () => {
    const { impl, calls } = fakeFetch([
      () => reply('I would rather describe it in prose.'),
      () => reply(CLEAN),
    ]);
    const outcome = await ruleOnPhotograph({ ...base, fetchImpl: impl });
    expect(outcome).toMatchObject({ ok: true, repaired: true });
    expect(calls).toHaveLength(2);
    const repairMessages = calls[1]?.body['messages'] as { role: string }[];
    expect(repairMessages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
  });

  it('rules unclear when the repair is also unreadable, and does not try a third time', async () => {
    const { impl, calls } = fakeFetch([() => reply('nope'), () => reply('still nope')]);
    const outcome = await ruleOnPhotograph({ ...base, fetchImpl: impl });
    expect(outcome).toMatchObject({ ok: true, verdict: ILLEGIBLE_RULING });
    expect(calls).toHaveLength(2);
  });

  it('rules unclear rather than reject, so an unreadable answer still awards the point', () => {
    expect(ILLEGIBLE_RULING.verdict).toBe('unclear');
  });

  it('reports upstream failure on a non-2xx response', async () => {
    const { impl } = fakeFetch([() => reply('{}', 500)]);
    await expect(ruleOnPhotograph({ ...base, fetchImpl: impl })).resolves.toEqual({
      ok: false,
      failure: 'upstream',
    });
  });

  it('reports upstream failure when the network throws', async () => {
    const { impl } = fakeFetch([
      () => {
        throw new Error('connection reset');
      },
    ]);
    await expect(ruleOnPhotograph({ ...base, fetchImpl: impl })).resolves.toEqual({
      ok: false,
      failure: 'upstream',
    });
  });

  it('never lets the thrown cause escape, since it can carry the photograph', async () => {
    const { impl } = fakeFetch([
      () => {
        throw new Error(`failed sending ${'x'.repeat(128)}`);
      },
    ]);
    const outcome = await ruleOnPhotograph({ ...base, fetchImpl: impl });
    expect(JSON.stringify(outcome)).not.toContain('xxxx');
  });

  it('skips the repair when there is not enough budget left for it', async () => {
    let clock = 0;
    const { impl, calls } = fakeFetch([
      () => {
        clock = 4_800; // First call nearly exhausted the server budget.
        return reply('unreadable');
      },
    ]);
    const outcome = await ruleOnPhotograph({
      ...base,
      fetchImpl: impl,
      now: () => clock,
    });
    expect(outcome).toMatchObject({ ok: true, verdict: ILLEGIBLE_RULING });
    expect(calls).toHaveLength(1);
  });

  it('gives up rather than calling with no budget left', async () => {
    let clock = 0;
    const { impl } = fakeFetch([
      () => {
        clock = 99_999;
        return reply('unreadable');
      },
    ]);
    const outcome = await ruleOnPhotograph({
      ...base,
      fetchImpl: impl,
      now: () => clock,
    });
    expect(outcome).toMatchObject({ ok: true, verdict: ILLEGIBLE_RULING });
  });

  it('digs a ruling out of prose without needing a repair', async () => {
    const { impl, calls } = fakeFetch([() => reply(`Very well. ${CLEAN} That is all.`)]);
    const outcome = await ruleOnPhotograph({ ...base, fetchImpl: impl });
    expect(outcome).toMatchObject({ ok: true, repaired: false });
    expect(calls).toHaveLength(1);
  });
});
