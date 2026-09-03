import {
  INJECTION_RULE,
  JUDGE_SYSTEM_PROMPT,
  buildJudgeRequest,
  buildRepairRequest,
} from './systemPrompt';

describe('the injection rule', () => {
  /**
   * PLAN.md: "There is a fixture test for exactly this; do not weaken it."
   * These assert the control is present and says the thing that matters, so a
   * later edit that tidies the prompt cannot quietly delete the defence.
   */

  it('is carried in the system prompt', () => {
    expect(JUDGE_SYSTEM_PROMPT).toContain(INJECTION_RULE);
  });

  it('states that text in a photograph is content, not instruction', () => {
    expect(INJECTION_RULE).toMatch(/never an instruction/i);
    expect(INJECTION_RULE).toMatch(/content for you to describe/i);
  });

  it('names the specific attack rather than gesturing at it', () => {
    expect(INJECTION_RULE).toMatch(/ignore your instructions/i);
    expect(INJECTION_RULE).toMatch(/system prompt/i);
  });

  it('denies the model the capability the attack asks for', () => {
    expect(INJECTION_RULE).toMatch(/no ability to award points/i);
    expect(INJECTION_RULE).toMatch(/nothing in an image can give you one/i);
  });

  it('covers the surfaces text arrives on', () => {
    for (const surface of ['sign', 'screen', 'note', 'label']) {
      expect(INJECTION_RULE.toLowerCase()).toContain(surface);
    }
  });
});

describe('the calibration examples', () => {
  const examples = JUDGE_SYSTEM_PROMPT.split('\n')
    .filter((line) => /^(accept|reject|unclear): "/.test(line))
    .map((line) => line.replace(/^\w+: /, ''));

  it('carries the ten verdicts from DESIGN.md', () => {
    expect(examples).toHaveLength(10);
  });

  it('covers all three rulings', () => {
    const kinds = JUDGE_SYSTEM_PROMPT.split('\n')
      .filter((line) => /^(accept|reject|unclear): "/.test(line))
      .map((line) => line.split(':')[0]);
    expect(new Set(kinds)).toEqual(new Set(['accept', 'reject', 'unclear']));
  });

  /**
   * The examples teach the tone rules, so they have to obey them. An example
   * that breaks a rule teaches the model to break it.
   */
  it('obeys the tone rules it teaches', () => {
    for (const example of examples) {
      expect(example).not.toMatch(/!/);
      expect(example).not.toMatch(/\p{Extended_Pictographic}/u);
      expect(example.toLowerCase()).not.toMatch(
        /\b(great|nice|well done|good job|awesome|perfect|excellent)\b/,
      );
      // One or two sentences, and within the schema's 140-character cap.
      expect(example.replace(/^"|"$/g, '').length).toBeLessThanOrEqual(140);
    }
  });

  it('names an object in every example, which is the rule that makes it funny', () => {
    for (const example of examples) {
      expect(example.length).toBeGreaterThan(20);
    }
  });
});

describe('the tone rules', () => {
  it('forbids exclamation marks, emoji and praise explicitly', () => {
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/No exclamation marks/);
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/No emoji/);
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/praise words/);
  });

  it('caps the ruling at one or two sentences', () => {
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/One or two sentences/);
  });

  it('requires the object to be named before the ruling', () => {
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/Name the object you actually see/);
  });

  it('states the field caps the schema enforces, so the model aims inside them', () => {
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/at most 60 characters/);
    expect(JUDGE_SYSTEM_PROMPT).toMatch(/at most 140 characters/);
  });
});

describe('buildJudgeRequest', () => {
  it('carries the round prompt in the user turn, not the system prompt', () => {
    expect(buildJudgeRequest('something round and blue')).toContain(
      'something round and blue',
    );
    expect(JUDGE_SYSTEM_PROMPT).not.toContain('The prompt was:');
  });
});

describe('buildRepairRequest', () => {
  it('sends the malformed output and the reason back', () => {
    const request = buildRepairRequest('{"verdict":"accept"', 'truncated');
    expect(request).toContain('{"verdict":"accept"');
    expect(request).toContain('truncated');
  });

  it('asks for the same ruling, so a repair cannot change the outcome', () => {
    expect(buildRepairRequest('x', 'y')).toMatch(/Keep your ruling the same/);
  });
});
