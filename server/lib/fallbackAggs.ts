// Resilient fallback for Massive v2 aggs endpoints
// Goal: reduce noisy 5xx/connection errors by serving a graceful empty payload
// when upstream is intermittently unavailable. Includes a tiny circuit breaker
// to avoid hammering the same failing path for a short TTL.

const FAILURE_TTL_MS = 300_000; // 5 minutes circuit breaker per path (increased to prevent excessive retries)

type FailureEntry = { failedAt: number; count: number };
const failureCache = new Map<string, FailureEntry>();

export function isV2AggsPath(path: string): boolean {
  // Match: /v2/aggs/ticker/<SYMBOL>/range/<mult>/<timespan>/<from>/<to>
  // Allow optional query string afterwards
  return /^\/?v2\/aggs\/ticker\/[^/]+\/range\//.test(path);
}

export function rememberFailure(path: string) {
  const now = Date.now();
  const prev = failureCache.get(path);
  failureCache.set(path, { failedAt: now, count: (prev?.count ?? 0) + 1 });
}

export function shouldShortCircuit(path: string): boolean {
  const entry = failureCache.get(path);
  if (!entry) return false;
  const age = Date.now() - entry.failedAt;
  if (age > FAILURE_TTL_MS) {
    failureCache.delete(path);
    return false;
  }
  return true;
}

export function buildEmptyAggsResponse() {
  // Align broadly with Massive v2 aggs shape
  return {
    results: [],
    queryCount: 0,
    resultsCount: 0,
    adjusted: true,
    status: 'OK',
    // Marker for debugging (not part of Massive schema but harmless)
    _fallback: 'empty',
  };
}
