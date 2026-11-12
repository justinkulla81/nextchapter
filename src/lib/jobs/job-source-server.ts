import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeEmployer } from '@/lib/jobs/job-source'

// Employers that list jobs on their own career site, for the board's source gate. One read of
// BoardLightRow's narrow copy (distinct names among employer-listed rows), held per server
// instance for ten minutes and served stale for up to thirty while a fresh copy loads.

const TTL_MS = 10 * 60_000
const STALE_MS = 30 * 60_000
let cache: { at: number; names: Promise<Set<string>> } | null = null

async function readNames(): Promise<Set<string>> {
  const rows = await prisma.$queryRaw<{ name: string }[]>`
    SELECT DISTINCT "companyName" AS name FROM "BoardLightRow"
    WHERE status = 'approved' AND "sourceCategory" IN ('employer', 'government', 'education', 'nonprofit', 'startup', 'vc_portfolio')`
  return new Set(rows.map((r) => normalizeEmployer(r.name)))
}

export function loadDirectEmployerNames(now = Date.now()): Promise<Set<string>> {
  const held = cache
  if (held && now - held.at < TTL_MS) return held.names
  const fresh = { at: now, names: readNames() }
  if (held && now - held.at < STALE_MS) {
    fresh.names.then(
      () => {
        cache = fresh
      },
      (error) => console.error('Direct employer names: refresh failed, keeping the held copy', error)
    )
    held.at = now
    return held.names
  }
  cache = fresh
  fresh.names.catch(() => {
    if (cache === fresh) cache = null
  })
  return fresh.names
}
