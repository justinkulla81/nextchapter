// Prisma's pool for one serverless instance defaults to a handful of connections and waits 10 seconds for a free one.
// A crawler burst on cold pages then fails with "Timed out fetching a new connection from the connection pool" (P2024)
// and the visitor, or Googlebot, gets a 500. These raise the limit and the wait on DATABASE_URL in code. A value
// already set higher in the URL is left alone. String edits on purpose: re-serializing the URL could re-encode a password.

export const POOL_CONNECTIONS = 12
export const POOL_TIMEOUT_SECONDS = 20

function atLeast(url: string, key: string, min: number): string {
  const m = new RegExp(`([?&])${key}=(\\d+)`).exec(url)
  if (m) return Number(m[2]) >= min ? url : url.replace(m[0], `${m[1]}${key}=${min}`)
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${min}`
}

/** DATABASE_URL with at least the pool size and pool wait above; undefined when it is unset. */
export function withPoolLimits(raw: string | undefined, connections = POOL_CONNECTIONS, timeoutSeconds = POOL_TIMEOUT_SECONDS): string | undefined {
  if (!raw) return undefined
  return atLeast(atLeast(raw, 'connection_limit', connections), 'pool_timeout', timeoutSeconds)
}
