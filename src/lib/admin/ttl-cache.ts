import 'server-only'

// Module-level in-memory TTL promise cache for admin reads that are identical
// across requests (same idea as src/lib/jobs/ghost-risk-data.ts). Per
// serverless instance; failures are never cached.
export function ttlCached<A extends unknown[], T>(
  ttlMs: number,
  fn: (...args: A) => Promise<T>,
  keyOf: (...args: A) => string = () => '',
): (...args: A) => Promise<T> {
  const store = new Map<string, { at: number; value: Promise<T> }>()
  return (...args: A) => {
    const key = keyOf(...args)
    const hit = store.get(key)
    if (hit && Date.now() - hit.at <= ttlMs) return hit.value
    const value = fn(...args)
    store.set(key, { at: Date.now(), value })
    value.catch(() => {
      if (store.get(key)?.value === value) store.delete(key)
    })
    if (store.size > 200) {
      const oldest = store.keys().next().value
      if (oldest !== undefined) store.delete(oldest)
    }
    return value
  }
}
