/**
 * Sliding-window limiter backed by an in-process Map.
 *
 * Scope: this holds for a single server instance. On Vercel with multiple
 * concurrent lambdas an attacker gets one window per instance, so before
 * going to production swap the store for Upstash Redis — the interface below
 * is deliberately narrow so only this file changes.
 */

interface Attempt {
  hits: number[];
  blockedUntil: number;
}

const store = new Map<string, Attempt>();
const SWEEP_AFTER = 10 * 60_000;
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < SWEEP_AFTER) return;
  lastSweep = now;
  for (const [key, entry] of store) {
    if (entry.blockedUntil < now && entry.hits.every((t) => now - t > SWEEP_AFTER)) {
      store.delete(key);
    }
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  { limit = 5, windowMs = 60_000, blockMs = 15 * 60_000 } = {},
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const entry = store.get(key) ?? { hits: [], blockedUntil: 0 };

  if (entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil((entry.blockedUntil - now) / 1000),
    };
  }

  entry.hits = entry.hits.filter((t) => now - t < windowMs);

  if (entry.hits.length >= limit) {
    entry.blockedUntil = now + blockMs;
    entry.hits = [];
    store.set(key, entry);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(blockMs / 1000) };
  }

  entry.hits.push(now);
  store.set(key, entry);
  return { allowed: true, remaining: limit - entry.hits.length, retryAfterSeconds: 0 };
}

/** Clears the window after a successful sign-in so honest users are not punished. */
export function resetLimit(key: string): void {
  store.delete(key);
}

/**
 * Rate-limit identity. Proxy headers are attacker-controlled, so this is a
 * best-effort signal — the real defence is Supabase's own auth throttling.
 */
export function clientKey(headers: Headers, scope: string): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwarded || headers.get('x-real-ip') || 'unknown';
  return `${scope}:${ip}`;
}
