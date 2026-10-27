import 'server-only'
import { PUBLIC_JOB_SITEMAP_SHARDS } from '@/lib/jobs/public-job-page'
import { publicJobIdsInShard } from '@/lib/jobs/public-job-page-server'
import { readJsonGz, STATE_BUCKET, writeJsonGz } from '@/lib/syndication/storage'
import {
  chunk,
  INDEXNOW_BATCH,
  INDEXNOW_ENDPOINT,
  INDEXNOW_NEW_PER_RUN,
  indexNowBody,
  jobPageUrl,
  planChanges,
  type LiveJob,
} from '@/lib/syndication/syndication'

/** Every job with a public page now, from the sitemap's shards (one partial-index scan each). */
export async function loadLiveJobs(): Promise<LiveJob[]> {
  const out: LiveJob[] = []
  for (let shard = 0; shard < PUBLIC_JOB_SITEMAP_SHARDS; shard++) {
    for (const r of await publicJobIdsInShard(shard)) out.push({ id: r.id, at: (r.postedAt ?? r.createdAt).getTime(), offered: r.offered })
  }
  return out
}

/** Which job ids a search engine has been told are live (and not since told they're gone). */
export interface AnnouncedState {
  v: 1
  ids: string[]
  updatedAt: string
}

export async function readAnnounced(path: string): Promise<Set<string>> {
  const s = await readJsonGz<AnnouncedState>(STATE_BUCKET, path)
  return new Set(s?.ids ?? [])
}

export async function writeAnnounced(path: string, ids: Set<string>): Promise<void> {
  await writeJsonGz(STATE_BUCKET, path, { v: 1, ids: [...ids], updatedAt: new Date().toISOString() } satisfies AnnouncedState)
}

const STATE_PATH = 'indexnow/announced.json.gz'

export interface IndexNowResult {
  dryRun: boolean
  live: number
  announcedBefore: number
  removedPlanned: number
  addedPlanned: number
  waitingForLaterRuns: number
  removedSent: number
  addedSent: number
  requests: { kind: 'removed' | 'added'; urls: number; status: number }[]
  stoppedEarly: string | null
  sample: string[]
}

/**
 * One IndexNow run: closed jobs since the last run (their pages 404 now), then jobs that
 * became public — newest first, INDEXNOW_NEW_PER_RUN at most, so the first backfill of
 * every public job spreads over a few runs. 10,000 URLs a request. The state is saved
 * after every accepted batch; a rejected batch (429, 5xx…) stops the run and the rest
 * goes next time.
 */
export async function runIndexNow(opts: { dryRun?: boolean } = {}): Promise<IndexNowResult> {
  const dryRun = !!opts.dryRun
  const [live, announced] = await Promise.all([loadLiveJobs(), readAnnounced(STATE_PATH)])
  const plan = planChanges(live, announced, INDEXNOW_NEW_PER_RUN)
  const result: IndexNowResult = {
    dryRun,
    live: live.length,
    announcedBefore: announced.size,
    removedPlanned: plan.removed.length,
    addedPlanned: plan.added.length,
    waitingForLaterRuns: plan.waiting,
    removedSent: 0,
    addedSent: 0,
    requests: [],
    stoppedEarly: null,
    sample: [...plan.removed.slice(0, 2), ...plan.added.slice(0, 3)].map(jobPageUrl),
  }
  if (dryRun) return result

  const batches = [
    ...chunk(plan.removed, INDEXNOW_BATCH).map((ids) => ({ kind: 'removed' as const, ids })),
    ...chunk(plan.added, INDEXNOW_BATCH).map((ids) => ({ kind: 'added' as const, ids })),
  ]
  for (const b of batches) {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(indexNowBody(b.ids.map(jobPageUrl))),
      signal: AbortSignal.timeout(60_000),
    })
    result.requests.push({ kind: b.kind, urls: b.ids.length, status: res.status })
    // 200 OK / 202 Accepted (key check pending). Anything else: stop, retry next run.
    if (res.status !== 200 && res.status !== 202) {
      result.stoppedEarly = `IndexNow answered ${res.status}: ${(await res.text()).slice(0, 300)}`
      break
    }
    if (b.kind === 'removed') {
      for (const id of b.ids) announced.delete(id)
      result.removedSent += b.ids.length
    } else {
      for (const id of b.ids) announced.add(id)
      result.addedSent += b.ids.length
    }
    await writeAnnounced(STATE_PATH, announced)
  }
  console.log('IndexNow run', { ...result, sample: undefined, requests: result.requests.length })
  return result
}
