import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { checkPostingLive } from '@/lib/jobs/liveness'
import { archiveDeadPostings, closeOpeningsQuietly, stampVerified } from '@/lib/jobs/liveness-store'
import { PUBLIC_JOB_SEARCH_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'
import { PUBLIC_JOB_MIN_INDEX_DESCRIPTION, PUBLIC_JOB_VERIFIED_DAYS, PUBLIC_JOB_VIEW_DAYS } from '@/lib/jobs/public-job-page'
import {
  REVERIFY_BUDGET_MS, REVERIFY_CHECK_TIMEOUT_MS, REVERIFY_CONCURRENCY, REVERIFY_PER_HOST, REVERIFY_PER_RUN,
  breakerTripped, hostOf, interleaveByHost, isFirmDead, reverifyShard,
} from '@/lib/jobs/direct-reverify-rules'

interface StaleRow { id: string; url: string; title: string; companyName: string; location: string | null }

export interface ReverifyResult { shard: number; picked: number; checked: number; live: number; archived: number; uncertain: number; unknown: number; breaker: boolean }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Direct jobs (employer system, ATS link or staffing firm) that have full text and were last confirmed open 14 to 30 days ago are
 * hidden from Google only because the crawl has not come back to them. This checks them the way a member's click does
 * (liveness.ts: the ATS's public job API, or the page's own JobPosting data): a job found live is stamped confirmed and is offered
 * again; a job the employer's system says is gone (404/410, canApply false, validThrough) is archived; anything unclear is left alone.
 * Reads at most REVERIFY_PER_RUN rows of one sitemap shard per run (partial index range); polite: an identified user agent, at most
 * 2 requests at once to one host, 8 in all.
 */
export async function runDirectReverify(now = new Date()): Promise<ReverifyResult> {
  const shard = reverifyShard(now)
  const out: ReverifyResult = { shard, picked: 0, checked: 0, live: 0, archived: 0, uncertain: 0, unknown: 0, breaker: false }
  const rows = await prisma.$queryRaw<StaleRow[]>`
    SELECT id, url, title, "companyName", location FROM "ExclusiveJobPosting"
    WHERE ${PUBLIC_JOB_STATIC_SQL}
      AND (hashtext(id) & 15) = ${shard}::int
      AND ${PUBLIC_JOB_SEARCH_SQL}
      AND source = 'ats_feed'
      AND octet_length(description) >= ${PUBLIC_JOB_MIN_INDEX_DESCRIPTION}
      AND "lastVerifiedAt" <= now() - make_interval(days => ${PUBLIC_JOB_VERIFIED_DAYS}::int)
      AND "lastVerifiedAt" > now() - make_interval(days => ${PUBLIC_JOB_VIEW_DAYS}::int)
    ORDER BY "lastVerifiedAt" DESC
    LIMIT ${REVERIFY_PER_RUN}`
  out.picked = rows.length
  if (rows.length === 0) return out

  const pending = interleaveByHost(rows)
  const inflight = new Map<string, number>()
  const liveRows: { url: string; at: Date }[] = []
  const deadIds: string[] = []
  const deadline = Date.now() + REVERIFY_BUDGET_MS

  await Promise.all(Array.from({ length: REVERIFY_CONCURRENCY }, async () => {
    while (Date.now() < deadline) {
      const i = pending.findIndex((r) => (inflight.get(hostOf(r.url)) ?? 0) < REVERIFY_PER_HOST)
      if (i === -1) {
        if (pending.length === 0) return
        await sleep(50)
        continue
      }
      const [row] = pending.splice(i, 1)
      const host = hostOf(row.url)
      inflight.set(host, (inflight.get(host) ?? 0) + 1)
      try {
        const r = await checkPostingLive(row, REVERIFY_CHECK_TIMEOUT_MS)
        out.checked++
        if (r.status === 'live') { out.live++; liveRows.push({ url: row.url, at: new Date() }) }
        else if (r.status === 'dead') { if (isFirmDead(r.note)) deadIds.push(row.id); else out.uncertain++ }
        else out.unknown++
      } finally {
        inflight.set(host, (inflight.get(host) ?? 1) - 1)
      }
    }
  }))

  if (liveRows.length) await stampVerified(liveRows)
  out.breaker = breakerTripped(out.checked, deadIds.length)
  if (deadIds.length && !out.breaker) {
    out.archived = await archiveDeadPostings({ ids: deadIds }, new Date())
    await closeOpeningsQuietly()
  }
  captureServerEvent('system', 'direct_reverify_run', { ...out })
  return out
}
