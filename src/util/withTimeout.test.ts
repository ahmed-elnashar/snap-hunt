import { TimeoutError, isTimeoutError, withTimeout } from './withTimeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('resolves with the value when the work finishes in time', async () => {
    const result = withTimeout(Promise.resolve('ruled'), 1000, 'judge');
    await expect(result).resolves.toBe('ruled');
  });

  it('rejects with a TimeoutError once the budget elapses', async () => {
    const never = new Promise<string>(() => {});
    const result = withTimeout(never, 6000, 'judge');
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    jest.advanceTimersByTime(6000);
    await assertion;
  });

  it('names the label and budget in the error, for a legible log', async () => {
    const never = new Promise<string>(() => {});
    const result = withTimeout(never, 6000, 'judge');
    const assertion = expect(result).rejects.toMatchObject({
      label: 'judge',
      ms: 6000,
      name: 'TimeoutError',
    });
    jest.advanceTimersByTime(6000);
    await assertion;
  });

  it('propagates the original rejection rather than masking it as a timeout', async () => {
    const boom = new Error('the shutter jammed');
    await expect(withTimeout(Promise.reject(boom), 1000, 'capture')).rejects.toBe(boom);
  });

  it('wraps a non-Error rejection so callers always catch an Error', async () => {
    await expect(
      withTimeout(Promise.reject('a bare string'), 1000, 'capture'),
    ).rejects.toBeInstanceOf(Error);
  });

  it('does not fire the timer after the work has resolved', async () => {
    await withTimeout(Promise.resolve(1), 1000, 'capture');
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not fire the timer after the work has rejected', async () => {
    await withTimeout(Promise.reject(new Error('no')), 1000, 'capture').catch(
      () => undefined,
    );
    expect(jest.getTimerCount()).toBe(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects an invalid budget %p',
    (ms) => {
      expect(() => withTimeout(Promise.resolve(1), ms, 'x')).toThrow(/positive number/);
    },
  );
});

describe('isTimeoutError', () => {
  it('distinguishes a timeout from any other failure', () => {
    expect(isTimeoutError(new TimeoutError('judge', 10))).toBe(true);
    expect(isTimeoutError(new Error('network'))).toBe(false);
    expect(isTimeoutError('timeout')).toBe(false);
    expect(isTimeoutError(null)).toBe(false);
  });
});
