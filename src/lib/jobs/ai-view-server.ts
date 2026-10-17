import 'server-only'
import { prisma } from '@/lib/prisma'
import type { AiView } from '@/lib/jobs/ai-view'

// The ids of postings that ask for a specific AI skill (aiSkillGroups non-empty), for the board's
// AI / Non-AI choice. BoardLightRow (the board's narrow copy) does not carry the AI columns, so
// the board's keep predicate checks membership in this set instead. One index-only read
// (ExclusiveJobPosting_ai_ids_idx, ~80 ms, ~28k ids), held per server instance for a minute and
// served stale for up to ten while a fresh copy loads.

const TTL_MS = 60_000
const STALE_MS = 10 * 60_000
let cache: { at: number; ids: Promise<Set<string>> } | null = null

async function readAiIds(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "ExclusiveJobPosting" WHERE cardinality("aiSkillGroups") > 0`
  return new Set(rows.map((r) => r.id))
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
