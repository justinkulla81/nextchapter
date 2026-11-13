import 'server-only'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { fetchText, parseJobPostingLd, type FeedPosting, type SitemapJob } from '@/lib/jobs/gov-feed-core'
import { isRelevantTitle, parseSitemap } from '@/lib/jobs/gov-titles'
import { CLASSIFY_NEW_US_NEOGOV_SQL } from '@/lib/jobs/jobsreport-classify-sql'

// Keeps the jobs-report table (jobsreport_posting, geo 'us-neogov') current from NEOGOV, weekly, inside the app, so it needs no
// GitHub secrets. It is the report's frame, not the board's: every white-collar title at every level (the title screen only,
// no seniority floor), with full descriptions. A posting still in the sitemap is seen again; one missing on two runs in a row
// is closed; new relevant jobs are fetched and inserted, then tagged with the white-collar rules.
//
// Database reads per run: the posting_id and missed_runs of this source's open rows (about 16,000 rows, two small columns, once
// a week). Writes: touches in batches of 2,000, and the inserts (a few hundred a week).

const GEO = 'us-neogov'
const SOURCE = 'neogov-national'
const SITEMAP_URL = 'https://www.governmentjobs.com/sitemap.xml'
const MIN_SITEMAP_JOBS = 20_000
const MAX_NEW_PER_RUN = 900
const TIME_BUDGET_MS = 110_000
const WORKERS = 6
const pid = (id: string) => `${GEO}:${SOURCE}:${id}`

export interface JobsReportNeogovResult {
  sitemapJobs: number
  relevant: number
  seen: number
  missed: number
  closed: number
  candidates: number
  fetched: number
  inserted: number
  tagged: number
  stoppedAtBudget: boolean
  note?: string
}

export async function runJobsReportNeogovFeed(): Promise<JobsReportNeogovResult> {
  const started = Date.now()
  const empty: JobsReportNeogovResult = { sitemapJobs: 0, relevant: 0, seen: 0, missed: 0, closed: 0, candidates: 0, fetched: 0, inserted: 0, tagged: 0, stoppedAtBudget: false }
  const xml = await fetchText(SITEMAP_URL, 90_000)
  const jobs = xml ? parseSitemap(xml) : []
  if (jobs.length < MIN_SITEMAP_JOBS) return { ...empty, sitemapJobs: jobs.length, note: 'sitemap missing or short: nothing changed' }
  const relevant = jobs.filter((j) => isRelevantTitle(j.title))
  const wanted = new Set(relevant.map((j) => pid(j.id)))

  const run = await prisma.$queryRaw<{ run_id: bigint }[]>`insert into jobsreport_run (geo, source_name, source_type) values (${GEO}, ${SOURCE}, 'public_sector') returning run_id`
  const runId = run[0].run_id

  const open = await prisma.$queryRaw<{ posting_id: string; missed_runs: number | null }[]>`
    select posting_id, missed_runs from jobsreport_posting
    where geo = ${GEO} and source_name = ${SOURCE} and closed_at is null limit 60000`
  const have = new Set(open.map((r) => r.posting_id))
  const stay = open.filter((r) => wanted.has(r.posting_id)).map((r) => r.posting_id)
  const gone = open.filter((r) => !wanted.has(r.posting_id))
  for (let i = 0; i < stay.length; i += 2000) {
    await prisma.$executeRaw`update jobsreport_posting set last_seen = now(), missed_runs = 0, last_run_id = ${runId}::bigint
      where posting_id = any(${stay.slice(i, i + 2000)}::text[])`
  }
  let closed = 0
  for (const r of gone) {
    const m = (r.missed_runs ?? 0) + 1
    if (m >= 2) closed += 1
    await prisma.$executeRaw`update jobsreport_posting set missed_runs = ${m}, closed_at = ${m >= 2 ? new Date() : null}::timestamptz where posting_id = ${r.posting_id}`
  }

  const candidates: SitemapJob[] = relevant.filter((j) => !have.has(pid(j.id))).slice(0, MAX_NEW_PER_RUN)
  const fetched: { job: SitemapJob; p: FeedPosting }[] = []
  let next = 0
  let stoppedAtBudget = false
  const worker = async () => {
    while (next < candidates.length) {
      if (Date.now() - started > TIME_BUDGET_MS) { stoppedAtBudget = true; return }
      const job = candidates[next++]
      const page = await fetchText(job.url, 15_000)
      const p = page ? parseJobPostingLd(page) : null
      if (p && p.employer) fetched.push({ job, p })
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker))

  let inserted = 0
  for (let i = 0; i < fetched.length; i += 200) {
    const batch = fetched.slice(i, i + 200)
    const city = (p: FeedPosting) => (p.location ? p.location.split(',')[0].trim() : null)
    const n = await prisma.$executeRaw(Prisma.sql`
      insert into jobsreport_posting (posting_id, geo, source_name, source_type, employer, title, url, description, desc_hash, location_raw,
        city, state, employment_type, pay_min, pay_max, pay_period, pay_stated, posted_at, posted_precision, arrangement, last_seen, last_run_id, missed_runs)
      select t.*, 'unspecified', now(), ${runId}::bigint, 0 from unnest(
        ${batch.map((b) => pid(b.job.id))}::text[], ${batch.map(() => GEO)}::text[], ${batch.map(() => SOURCE)}::text[], ${batch.map(() => 'public_sector')}::text[],
        ${batch.map((b) => b.p.employer)}::text[], ${batch.map((b) => b.p.title)}::text[], ${batch.map((b) => b.job.url)}::text[],
        ${batch.map((b) => b.p.description)}::text[], ${batch.map((b) => (b.p.description ? createHash('sha1').update(b.p.description).digest('hex') : null))}::text[],
        ${batch.map((b) => b.p.location)}::text[], ${batch.map((b) => city(b.p))}::text[], ${batch.map((b) => b.p.state)}::text[],
        ${batch.map((b) => b.p.employmentType)}::text[], ${batch.map((b) => b.p.salaryMin)}::numeric[], ${batch.map((b) => b.p.salaryMax)}::numeric[],
        ${batch.map((b) => (b.p.salaryMin ? 'year' : null))}::text[], ${batch.map((b) => b.p.salaryMin != null)}::boolean[],
        ${batch.map((b) => (b.p.postedAt ? b.p.postedAt.toISOString() : null))}::timestamptz[], ${batch.map(() => 'date')}::text[]
      ) as t(posting_id, geo, source_name, source_type, employer, title, url, description, desc_hash, location_raw, city, state, employment_type,
        pay_min, pay_max, pay_period, pay_stated, posted_at, posted_precision)
      on conflict (posting_id) do nothing`)
    inserted += Number(n)
  }
  const tagged = inserted > 0 ? Number(await prisma.$executeRawUnsafe(CLASSIFY_NEW_US_NEOGOV_SQL)) : 0
  await prisma.$executeRaw`update jobsreport_run set finished_at = now(), fetched = ${fetched.length} where run_id = ${runId}`
  return { sitemapJobs: jobs.length, relevant: relevant.length, seen: stay.length, missed: gone.length, closed, candidates: candidates.length, fetched: fetched.length, inserted, tagged, stoppedAtBudget }
}
