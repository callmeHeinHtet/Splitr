/**
 * Per-IP sliding-window rate limiter, in-memory.
 *
 * Caveat: in serverless (Vercel Functions) each lambda instance keeps its own
 * map, so a high-fanout abuser hitting fresh cold starts can briefly exceed
 * the limit. For stronger guarantees, swap the buckets store for Vercel KV
 * or Upstash Ratelimit. For a portfolio bill-split app, this is enough to
 * stop accidental hammering and keep your Gemini quota safe.
 */

import { NextRequest } from "next/server";

type Bucket = { hits: number[]; firstSeen: number };

const BUCKETS = new Map<string, Bucket>();
const MAX_KEYS = 5000; // crude memory cap

export type RateLimitOptions = {
  /** Logical name used to namespace the bucket (e.g. "parse"). */
  name: string;
  /** Max requests permitted in `windowMs`. */
  max: number;
  /** Window length in ms. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Epoch ms when the oldest hit in the window will expire. */
  resetAt: number;
};

export function rateLimit(
  req: NextRequest,
  opts: RateLimitOptions,
): RateLimitResult {
  const ip = clientIp(req);
  const key = `${opts.name}:${ip}`;
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  let bucket = BUCKETS.get(key);
  if (!bucket) {
    bucket = { hits: [], firstSeen: now };
    if (BUCKETS.size >= MAX_KEYS) evictOldest();
    BUCKETS.set(key, bucket);
  }

  // Drop hits outside the window.
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= opts.max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: bucket.hits[0] + opts.windowMs,
    };
  }

  bucket.hits.push(now);
  return {
    allowed: true,
    remaining: opts.max - bucket.hits.length,
    resetAt: now + opts.windowMs,
  };
}

function clientIp(req: NextRequest): string {
  // Vercel injects x-forwarded-for as a comma-separated list; the first entry
  // is the real client. Locally req.ip is set; otherwise unknown.
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

function evictOldest() {
  let oldestKey: string | null = null;
  let oldestSeen = Infinity;
  for (const [k, b] of BUCKETS) {
    if (b.firstSeen < oldestSeen) {
      oldestSeen = b.firstSeen;
      oldestKey = k;
    }
  }
  if (oldestKey) BUCKETS.delete(oldestKey);
}
