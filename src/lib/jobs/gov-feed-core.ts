import { screenImportedJob } from '@/lib/jobs/import-screen'
import { fullDescriptionOf, skillsFrom } from '@/lib/jobs/posting-text'

// Shared by the government job feeds (NEOGOV, K12JobSpot, USAJOBS): fetching, JobPosting parsing, the board's import
// screen and the shape of a job-board row. No database access here, so the same code can be run by a script.

export const USER_AGENT = 'NextChapterResearch/1.0 (+https://launchyournextchapter.com/reports)'
export const THIRTY_DAYS_MS = 30 * 86_400_000
export const YEAR_MS = 365 * 86_400_000 // the board hides direct listings older than this

export function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
}
export function htmlToText(html: string): string {
  return decodeEntities(decodeEntities(html).replace(/<\/(p|div|li|h\d|tr)>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
}

export async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xml,application/json' } })
    return res.ok ? await res.text() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface SitemapJob { id: string; url: string; title: string }

export interface FeedPosting {
  title: string
  employer: string
  location: string | null
  state: string | null
  description: string
  postedAt: Date | null
  employmentType: string | null
  salaryMin: number | null
  salaryMax: number | null
}

type Address = { addressLocality?: string; addressRegion?: string }

/** The JobPosting JSON-LD block of a job page, as a posting; null when the page has none. */
export function parseJobPostingLd(page: string): FeedPosting | null {
  let posting: Record<string, unknown> | null = null
  for (const m of page.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1])
      const found = (Array.isArray(d) ? d : [d]).find((x) => x && typeof x === 'object' && x['@type'] === 'JobPosting')
      if (found) { posting = found; break }
    } catch { /* not this block */ }
  }
  if (!posting || typeof posting.title !== 'string' || !posting.title.trim()) return null
  const place = posting.jobLocation as { address?: Address } | { address?: Address }[] | undefined
  const addr: Address = (Array.isArray(place) ? place[0]?.address : place?.address) ?? {}
  const region = (addr.addressRegion ?? '').trim()
  const state = /^[A-Z]{2}$/.test(region) ? region : null
  let city = (addr.addressLocality ?? '').split(',')[0].trim()
  if (/\d{5}/.test(city)) city = ''
  const location = [city, region].filter(Boolean).join(', ') || null
  const value = ((posting.baseSalary as { value?: { minValue?: number; maxValue?: number; unitText?: string } } | undefined)?.value) ?? {}
  const yearly = String(value.unitText ?? '').toUpperCase() === 'YEAR' && Number(value.minValue) > 0
  const posted = typeof posting.datePosted === 'string' ? new Date(posting.datePosted) : null
  const rawType = Array.isArray(posting.employmentType) ? posting.employmentType[0] : posting.employmentType
  const type = typeof rawType === 'string' ? rawType : null
  return {
    title: decodeEntities(posting.title).trim(),
    employer: ((posting.hiringOrganization as { name?: string } | undefined)?.name ?? '').trim(),
    location,
    state,
    description: htmlToText(typeof posting.description === 'string' ? posting.description : ''),
    postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    employmentType: type === 'FULL_TIME' ? 'full_time' : type === 'PART_TIME' ? 'part_time' : null,
    salaryMin: yearly ? Math.round(Number(value.minValue)) : null,
    salaryMax: yearly ? Math.round(Number(value.maxValue ?? value.minValue)) : null,
  }
}

export interface FeedSource {
  /** Stored on the row: who added it. Never 'ncrawl', so ncrawl syncs cannot archive these rows. */
  addedBy: string
  sourceName: string
  /** True when the job is taken from the employer's own job system; false for an aggregator's copy. Default true. */
  direct?: boolean
}

export interface KeptJob {
  url: string
  posting: FeedPosting
  level: string
  location: string | null
  closesAt?: Date | null
}

export type SkipReason = 'screen' | 'old' | 'internal'

/** The board's own import screen plus the feeds' rules; null reason means keep. */
export function judge(posting: FeedPosting, now: Date): { keep: true; level: string; location: string | null } | { keep: false; reason: SkipReason } {
  if (/\binternal (candidates|applicants|employees) only\b|\binternal only\b/i.test(posting.title + ' ' + posting.description.slice(0, 600))) return { keep: false, reason: 'internal' }
  // Some listings name the job (or a recruiter's header) in the employer field; the employer is unknown, so skip them.
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (norm(posting.employer).includes(norm(posting.title)) || norm(posting.title).includes(norm(posting.employer))) return { keep: false, reason: 'screen' }
  const verdict = screenImportedJob(posting.title, posting.location, { companyName: posting.employer, description: posting.description })
  if (!verdict.keep) return { keep: false, reason: 'screen' }
  if (posting.postedAt && now.getTime() - posting.postedAt.getTime() > YEAR_MS) return { keep: false, reason: 'old' }
  return { keep: true, level: verdict.level, location: verdict.location }
}

/** A job-board row (ExclusiveJobPosting columns) for a kept job, without id and companyId. */
export function boardRow(k: KeptJob, src: FeedSource, now: Date, expiresAt: Date) {
  const p = k.posting
  const paid = p.salaryMin != null
  return {
    title: p.title,
    companyName: p.employer,
    location: k.location,
    url: k.url,
    description: fullDescriptionOf(p.description),
    skills: skillsFrom(p.title, p.description),
    level: k.level,
    sourceCategory: 'public_sector',
    postingType: src.direct === false ? null : 'direct',
    directListing: src.direct !== false,
    source: 'ats_feed',
    status: 'approved',
    addedBy: src.addedBy,
    sourceName: src.sourceName,
    salaryMin: p.salaryMin,
    salaryMax: p.salaryMax,
    salaryCurrency: paid ? 'USD' : null,
    payPeriod: paid ? 'year' : null,
    paySource: paid ? 'posted' : null,
    employmentType: p.employmentType,
    locationStates: p.state ? [p.state] : [],
    postedAt: p.postedAt,
    expiresAt,
    lastConfirmedAt: now,
    lastVerifiedAt: now,
  }
}

export interface CollectStats { candidates: number; fetched: number; skippedByScreen: number; skippedOld: number; skippedInternal: number; stoppedAtBudget: boolean }

/** Fetches the job pages of `candidates` a few at a time, judges each, and returns the keepers. Stops at the time budget. */
export async function collectFromPages(
  candidates: SitemapJob[],
  opts: { workers: number; fetchTimeoutMs: number; deadline: number; now: Date },
): Promise<{ kept: KeptJob[]; stats: CollectStats }> {
  const kept: KeptJob[] = []
  const stats: CollectStats = { candidates: candidates.length, fetched: 0, skippedByScreen: 0, skippedOld: 0, skippedInternal: 0, stoppedAtBudget: false }
  let next = 0
  const worker = async () => {
    while (next < candidates.length) {
      if (Date.now() > opts.deadline) { stats.stoppedAtBudget = true; return }
      const job = candidates[next++]
      const page = await fetchText(job.url, opts.fetchTimeoutMs)
      const posting = page ? parseJobPostingLd(page) : null
      if (!posting || !posting.employer) continue
      stats.fetched += 1
      const v = judge(posting, opts.now)
      if (!v.keep) {
        if (v.reason === 'screen') stats.skippedByScreen += 1
        else if (v.reason === 'old') stats.skippedOld += 1
        else stats.skippedInternal += 1
        continue
      }
      kept.push({ url: job.url, posting, level: v.level, location: v.location })
    }
  }
  await Promise.all(Array.from({ length: opts.workers }, worker))
  return { kept, stats }
}

/** Normalised employer and title, to spot the same job listed by two sources. */
export function dedupeKey(employer: string, title: string): string {
  const n = (x: string) => x.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim()
  return `${n(employer)}|${n(title)}`
}
