import 'server-only'
import { prisma } from '@/lib/prisma'

// Posting id -> posting signals (posting-signals.ts) for every job that carries one, for the board's
// "Open to career changers / AI-upskilled" filter and the welcome lift. BoardLightRow (the board's
// narrow copy) does not carry the column, so the board checks this map instead — the same pattern
// as the AI / Non-AI ids (ai-view-server.ts). One index-only read (ExclusiveJobPosting_posting_signals_idx,
// a few thousand rows), held per server instance for a minute and served stale for up to ten while
// a fresh copy loads.

const TTL_MS = 60_000
const STALE_MS = 10 * 60_000
let cache: { at: number; map: Promise<Map<string, string[]>> } | null = null

async function readSignals(): Promise<Map<string, string[]>> {
  const rows = await prisma.$queryRaw<{ id: string; s: string[] }[]>`
    SELECT id, "postingSignals" AS s FROM "ExclusiveJobPosting" WHERE cardinality("postingSignals") > 0`
  return new Map(rows.map((r) => [r.id, r.s]))
}

export function loadPostingSignalMap(now = Date.now()): Promise<Map<string, string[]>> {
  const held = cache
  if (held && now - held.at < TTL_MS) return held.map
  const fresh = { at: now, map: readSignals() }
  if (held && now - held.at < STALE_MS) {
    fresh.map.then(
      () => {
        cache = fresh
      },
      (error) => console.error('Posting signals: refresh failed, keeping the held copy', error)
    )
    held.at = now // one refresh at a time
    return held.map
  }
  cache = fresh
  fresh.map.catch(() => {
    if (cache === fresh) cache = null
  })
  return fresh.map
}
