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

function pruneExpired(now: number): void {
    for (const [k, v] of attempts.entries()) {
        if (now - v.firstFailureAt > WINDOW_MS) {
            attempts.delete(k);
        }
    }
}

function evictOldest(now: number): void {
    pruneExpired(now);
    if (attempts.size < MAX_TRACKED_KEYS) return;

    // First evict attempts that haven't reached lockout threshold
    for (const [k, v] of attempts.entries()) {
        if (v.count < MAX_ATTEMPTS) {
            attempts.delete(k);
            return;
        }
    }

    // If all tracked entries are locked out, evict the oldest
    const oldestKey = attempts.keys().next().value;
    if (oldestKey !== undefined) {
        attempts.delete(oldestKey);
    }
}

export function recordFailure(key: string): void {
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || now - entry.firstFailureAt > WINDOW_MS) {
        if (!entry && attempts.size >= MAX_TRACKED_KEYS) {
            evictOldest(now);
        }
        attempts.set(key, { count: 1, firstFailureAt: now });
        return;
    }

    entry.count += 1;
}

export function clearAttempts(key: string): void {
    attempts.delete(key);
}
