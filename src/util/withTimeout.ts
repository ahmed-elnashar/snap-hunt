/**
 * Every async call in this app has a timeout and a UI-visible error path.
 * This is the timeout half.
 */

export class TimeoutError extends Error {
  override readonly name = 'TimeoutError';
  readonly label: string;
  readonly ms: number;

  constructor(label: string, ms: number) {
    super(`${label} did not finish within ${ms}ms`);
    this.label = label;
    this.ms = ms;
  }
}

export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Rejects with a TimeoutError if `promise` has not settled within `ms`.
 *
 * This races; it does not cancel. The underlying work keeps running and its
 * result is discarded. That is the honest behaviour for work with no abort
 * signal, such as native image manipulation. Anything that *can* be cancelled —
 * notably fetch — should be given an AbortSignal instead, and may use this as a
 * belt-and-braces outer bound.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) {
    throw new Error(`Timeout must be a positive number of milliseconds: got ${ms}`);
  }

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
