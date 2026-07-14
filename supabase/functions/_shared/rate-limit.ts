interface AttemptWindow {
  failures: number[];
}

export interface AttemptStatus {
  blocked: boolean;
  retryAfterSeconds: number;
}

export interface AttemptLimiter {
  status(key: string, nowMs: number): AttemptStatus;
  recordFailure(key: string, nowMs: number): void;
  reset(key: string): void;
}

export class MemoryAttemptLimiter implements AttemptLimiter {
  readonly #windows = new Map<string, AttemptWindow>();

  public constructor(
    private readonly maxFailures = 5,
    private readonly windowMs = 15 * 60 * 1_000,
  ) {}

  public status(key: string, nowMs: number): AttemptStatus {
    const failures = this.#recentFailures(key, nowMs);
    if (failures.length < this.maxFailures) return { blocked: false, retryAfterSeconds: 0 };
    const oldest = failures[0] ?? nowMs;
    return {
      blocked: true,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + this.windowMs - nowMs) / 1_000)),
    };
  }

  public recordFailure(key: string, nowMs: number): void {
    const failures = this.#recentFailures(key, nowMs);
    failures.push(nowMs);
    this.#windows.set(key, { failures });
  }

  public reset(key: string): void {
    this.#windows.delete(key);
  }

  #recentFailures(key: string, nowMs: number): number[] {
    const cutoff = nowMs - this.windowMs;
    const failures = (this.#windows.get(key)?.failures ?? []).filter((timestamp) => timestamp > cutoff);
    if (failures.length === 0) this.#windows.delete(key);
    else this.#windows.set(key, { failures });
    return failures;
  }
}
