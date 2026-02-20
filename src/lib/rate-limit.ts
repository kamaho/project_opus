/**
 * Simple in-memory rate limiter using a sliding window.
 * Suitable for single-instance deployments. Replace with @upstash/ratelimit
 * for multi-instance/serverless deployments.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetMs: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  cleanup(config.windowMs);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  const cutoff = now - config.windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

  if (entry.timestamps.length >= config.limit) {
    const oldest = entry.timestamps[0];
    return {
      success: false,
      remaining: 0,
      resetMs: oldest + config.windowMs - now,
    };
  }

  entry.timestamps.push(now);
  return {
    success: true,
    remaining: config.limit - entry.timestamps.length,
    resetMs: config.windowMs,
  };
}

export const RATE_LIMITS = {
  import: { limit: 20, windowMs: 60_000 } as RateLimitConfig,
  api: { limit: 100, windowMs: 60_000 } as RateLimitConfig,
} as const;
