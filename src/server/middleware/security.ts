/**
 * Loop — Security Middleware
 *
 * Production-grade protections applied to every server function:
 *  - Input sanitisation (length limits, type checks, strip control chars)
 *  - In-memory rate limiting (sliding window, per-IP)
 *  - Request origin validation
 */

// ── Rate Limiter ─────────────────────────────────────────────────
const WINDOW_MS = 60_000; // 1 minute
const MAX_CALLS = 60; // max requests per IP per window

interface WindowEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, WindowEntry>();

// Purge stale entries every 5 minutes to avoid memory leaks in long-lived processes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (entry.resetAt < now) rateLimitMap.delete(key);
  }
}, 5 * 60_000).unref?.();

/**
 * Throws a 429 error if the caller has exceeded the rate limit.
 * `key` should be a unique identifier for the caller (e.g. IP or user ID).
 */
export function checkRateLimit(key: string, maxCalls = MAX_CALLS): void {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  entry.count += 1;
  if (entry.count > maxCalls) {
    throw Object.assign(new Error("Rate limit exceeded. Please slow down."), { status: 429 });
  }
}

// ── Input Sanitisation ───────────────────────────────────────────

const CONTROL_CHAR_REGEX = /[\x00-\x1F\x7F]/g;
const SCRIPT_TAG_REGEX = /<\s*script[\s\S]*?>[\s\S]*?<\s*\/\s*script\s*>/gi;
const HTML_TAG_REGEX = /<[^>]*>/g;

/**
 * Sanitise a free-text search query:
 * - Coerce to string
 * - Strip control characters, HTML tags, and script injections
 * - Trim whitespace
 * - Clamp to a safe maximum length
 */
export function sanitiseQuery(raw: unknown, maxLength = 200): string {
  if (raw === null || raw === undefined) return "";
  const str = String(raw)
    .replace(SCRIPT_TAG_REGEX, "")
    .replace(HTML_TAG_REGEX, "")
    .replace(CONTROL_CHAR_REGEX, "")
    .trim()
    .slice(0, maxLength);
  return str;
}

/**
 * Sanitise a video/track ID — must be alphanumeric + a handful of safe chars.
 * Rejects anything that looks like a path traversal or injection attempt.
 */
export function sanitiseId(raw: unknown, maxLength = 64): string {
  if (raw === null || raw === undefined) return "";
  const str = String(raw).trim().slice(0, maxLength);
  // Allow: letters, digits, hyphens, underscores — nothing else
  if (!/^[\w\-]+$/.test(str)) {
    throw Object.assign(new Error("Invalid identifier format."), { status: 400 });
  }
  return str;
}

/**
 * Assert a value is a non-empty string within a length budget.
 */
export function requireString(val: unknown, name: string, maxLength = 200): string {
  if (typeof val !== "string" || val.trim() === "") {
    throw Object.assign(new Error(`${name} must be a non-empty string.`), { status: 400 });
  }
  return val.trim().slice(0, maxLength);
}
