import 'server-only'
import { gunzipSync, gzipSync } from 'node:zlib'
import { unstable_cache } from 'next/cache'

// Shared helpers for the public SEO pages, which run scans that read tens of thousands of rows. A crawl asks for many
// pages at once, and one server instance serves many requests at the same time, so without a limit those scans take
// every database connection and ordinary pages (a job page, a lookup) time out waiting for one (Prisma P2024).

const MAX_HEAVY = 3
let running = 0
const waiting: (() => void)[] = []

/** Runs `run` when fewer than MAX_HEAVY heavy scans are in flight on this instance; otherwise waits its turn. */
export async function heavy<T>(run: () => Promise<T>): Promise<T> {
  if (running >= MAX_HEAVY) await new Promise<void>((resolve) => waiting.push(resolve))
  running++
  try {
    return await run()
  } finally {
    running--
    waiting.shift()?.()
  }
}

interface Entry<T> { at: number; value: Promise<T> }

/**
 * Remembers a loader's result on this instance for `ttlMs`, and shares one in-flight load between requests that ask for
 * the same key at the same time. A failed load is forgotten at once, so the next request tries again.
 */
export function memoTtl<A extends unknown[], T>(ttlMs: number, keyOf: (...args: A) => string, load: (...args: A) => Promise<T>): (...args: A) => Promise<T> {
  const store = new Map<string, Entry<T>>()
  return (...args: A) => {
    const key = keyOf(...args)
    const hit = store.get(key)
    if (hit && Date.now() - hit.at < ttlMs) return hit.value
    const value = load(...args)
    store.set(key, { at: Date.now(), value })
    value.catch(() => {
      if (store.get(key)?.value === value) store.delete(key)
    })
    if (store.size > 200) {
      const oldest = [...store].sort((a, b) => a[1].at - b[1].at)[0]
      store.delete(oldest[0])
    }
    return value
  }
}

/**
 * True for a read that failed only because no connection was free: Prisma's "timed out fetching a connection from the pool" (P2024),
 * or the pooler's own "max client connections reached" (EMAXCONN, seen 2026-10-30 in the two minutes after a deploy, when every
 * instance starts cold at once). Both clear within seconds, so the read is worth trying again.
 */
export const isPoolTimeout = (e: unknown) => {
  if (typeof e !== 'object' || e === null) return false
  const { code, message } = e as { code?: string; message?: string }
  return code === 'P2024' || (typeof message === 'string' && /EMAXCONN|max client connections reached/i.test(message))
}

/** Retries a read that failed only because the connection pool was busy, twice, with a short wait. */
export async function retryOnPoolTimeout<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run()
    } catch (e) {
      if (!isPoolTimeout(e) || attempt >= 2) throw e
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)))
    }
  }
}

const ISO_DATE = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/

/**
 * A loader's result kept for `revalidateSec` in Next's data cache, which every server instance on Vercel shares. memoTtl only holds a
 * result on one instance, and instances start cold all day, so each one re-read the same tables from the database; those reads were
 * the bulk of its outbound data. Stored as gzipped JSON (an entry is capped at 2 MB), with dates read back as dates. Where the cache is not
 * available (a script, a test) it just runs the loader. Results must be plain data: no Maps, Sets or class instances.
 */
export async function sharedLoad<T>(key: string, revalidateSec: number, load: () => Promise<T>): Promise<T> {
  let loadFailed = false
  const pack = unstable_cache(
    async () => {
      try {
        return gzipSync(JSON.stringify(await load())).toString('base64')
      } catch (e) {
        loadFailed = true
        throw e
      }
    },
    ['shared-load', key],
    { revalidate: revalidateSec, tags: [`shared-load:${key}`] }
  )
  let packed: string
  try {
    packed = await pack()
  } catch (e) {
    if (loadFailed) throw e
    return load()
  }
  return JSON.parse(gunzipSync(Buffer.from(packed, 'base64')).toString(), (_k, v) => (typeof v === 'string' && ISO_DATE.test(v) ? new Date(v) : v)) as T
}
