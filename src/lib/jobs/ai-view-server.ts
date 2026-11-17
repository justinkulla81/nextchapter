import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sharedPartsLoad } from '@/lib/db/heavy'
import type { AiView } from '@/lib/jobs/ai-view'

// The ids of postings that ask for a specific AI skill (aiSkillGroups non-empty), for the board's
// AI / Non-AI choice. BoardLightRow (the board's narrow copy) does not carry the AI columns, so
// the board's keep predicate checks membership in this set instead. One index-only read
// (ExclusiveJobPosting_ai_ids_idx, ~80 ms, ~28k ids), held per server instance for a minute and
// served stale for up to ten while a fresh copy loads.

// Owner decision 2026-11-17 (Supabase egress): the ids (~120k) come from the shared data cache, refreshed every two hours like the board,
// and each instance asks that cache every ten minutes. At a minute per instance the whole set was re-read all day (~1.4 GB a day).
const TTL_MS = 10 * 60_000
const STALE_MS = 2 * 60 * 60_000
const SHARED_SEC = 2 * 3600
const PARTS = 6
let cache: { at: number; ids: Promise<Set<string>> } | null = null

async function readAiIds(): Promise<Set<string>> {
  const ids = await sharedPartsLoad('ai-posting-ids-v1', PARTS, SHARED_SEC, async (part) => {
    const rows = await prisma.$queryRaw<{ id: string }[]>(
      Prisma.sql`SELECT id FROM "ExclusiveJobPosting" WHERE cardinality("aiSkillGroups") > 0 AND (hashtext(id) & 2147483647) % ${PARTS}::int = ${part}::int`
    )
    return rows.map((r) => r.id)
  })
  return new Set(ids)
}

export function loadAiPostingIds(now = Date.now()): Promise<Set<string>> {
  const held = cache
  if (held && now - held.at < TTL_MS) return held.ids
  const fresh = { at: now, ids: readAiIds() }
  if (held && now - held.at < STALE_MS) {
    // Serve the held copy; swap in the fresh one once it loads (keep the old one if it fails).
    fresh.ids.then(
      () => {
        cache = fresh
      },
      (error) => console.error('AI posting ids: refresh failed, keeping the held copy', error)
    )
    held.at = now // one refresh at a time
    return held.ids
  }
  cache = fresh
  fresh.ids.catch(() => {
    if (cache === fresh) cache = null
  })
  return fresh.ids
}

/** The board keep predicate for a view; null for All. */
export function aiViewKeep(view: AiView, aiIds: Set<string>): ((p: { id: string }) => boolean) | null {
  if (view === 'all') return null
  return view === 'ai' ? (p) => aiIds.has(p.id) : (p) => !aiIds.has(p.id)
}
