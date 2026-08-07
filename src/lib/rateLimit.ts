const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

// Crude safety valve against unbounded growth if someone hammers the endpoint with
// many distinct usernames. Not expected to ever trigger at this app's scale.
const MAX_TRACKED_KEYS = 500;

type Attempt = { count: number; firstFailureAt: number };

const attempts = new Map<string, Attempt>();

export function isRateLimited(key: string): { limited: boolean; retryAfterMs: number } {
    const entry = attempts.get(key);
    if (!entry) return { limited: false, retryAfterMs: 0 };

    const elapsed = Date.now() - entry.firstFailureAt;
    if (elapsed > WINDOW_MS) {
        attempts.delete(key);
        return { limited: false, retryAfterMs: 0 };
    }

    if (entry.count >= MAX_ATTEMPTS) {
        return { limited: true, retryAfterMs: WINDOW_MS - elapsed };
    }
    return { limited: false, retryAfterMs: 0 };
}

export function recordFailure(key: string): void {
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || now - entry.firstFailureAt > WINDOW_MS) {
        if (!entry && attempts.size >= MAX_TRACKED_KEYS) attempts.clear();
        attempts.set(key, { count: 1, firstFailureAt: now });
        return;
    }

    entry.count += 1;
}

export function clearAttempts(key: string): void {
    attempts.delete(key);
}
