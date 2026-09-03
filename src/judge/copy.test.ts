import { ALL_FAILURES, copyForFailure } from './copy';

describe('failure copy', () => {
  it('covers every failure the client can report', () => {
    for (const reason of ALL_FAILURES) {
      expect(copyForFailure(reason).ruling.length).toBeGreaterThan(0);
    }
  });

  /**
   * The voice rules from DESIGN.md, applied mechanically. A string a generic
   * app could have used is wrong, and "Network error" is the example.
   */
  describe.each(ALL_FAILURES)('%s', (reason) => {
    const copy = copyForFailure(reason, 1800);
    const strings = [copy.ruling, copy.note, copy.action];

    it('uses no exclamation marks', () => {
      for (const s of strings) expect(s).not.toMatch(/!/);
    });

    it('uses no emoji', () => {
      for (const s of strings) expect(s).not.toMatch(/\p{Extended_Pictographic}/u);
    });

    it('uses no praise words', () => {
      for (const s of strings) {
        expect(s.toLowerCase()).not.toMatch(
          /\b(great|nice|well done|good job|awesome|perfect|excellent|oops|sorry)\b/,
        );
      }
    });

    it('never says the generic thing', () => {
      for (const s of strings) {
        expect(s.toLowerCase()).not.toMatch(
          /\b(network error|something went wrong|an error occurred|try again later|failed to)\b/,
        );
      }
    });

    it('appends no arrow to the action', () => {
      expect(copy.action).not.toMatch(/[→›»>]/);
    });

    it('keeps the ruling to one or two sentences', () => {
      const sentences = copy.ruling.split(/(?<=[.?])\s+/).filter(Boolean);
      expect(sentences.length).toBeLessThanOrEqual(2);
    });
  });

  describe('the round is never quietly spent', () => {
    it('says so for every failure that is not the office being shut', () => {
      for (const reason of ['network', 'timeout', 'unparseable'] as const) {
        expect(copyForFailure(reason).note.toLowerCase()).toMatch(
          /round (is not spent|still stands)/,
        );
      }
    });
  });

  describe('the rate limit tells you when to come back', () => {
    it('rounds a half hour to minutes', () => {
      expect(copyForFailure('ratelimit', 1800).ruling).toContain('in about 30 minutes');
    });

    it('says an hour when it is nearly an hour', () => {
      expect(copyForFailure('ratelimit', 3600).ruling).toContain('in about an hour');
    });

    it('says a minute rather than "in about 1 minutes"', () => {
      expect(copyForFailure('ratelimit', 45).ruling).toContain('in a minute');
    });

    it('never reports a wait of zero', () => {
      expect(copyForFailure('ratelimit', 0).ruling).toContain('in a minute');
    });

    it('falls back gracefully when the server sent no wait', () => {
      expect(copyForFailure('ratelimit').ruling).toContain('within the hour');
    });

    it('never shows the player a raw status code', () => {
      const copy = copyForFailure('ratelimit', 1800);
      expect(`${copy.ruling} ${copy.note}`).not.toMatch(/429|5\d\d|HTTP/);
    });
  });
});
