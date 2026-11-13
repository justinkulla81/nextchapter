import 'server-only'
import { prisma } from '@/lib/prisma'
import { screenImportedJob } from '@/lib/jobs/import-screen'
import { fullDescriptionOf, skillsFrom } from '@/lib/jobs/posting-text'
import { linkPostingsToCompanies } from '@/lib/companies/posting-company'

// Government jobs from NEOGOV (governmentjobs.com), nationwide, kept current weekly.
//
// The site publishes every open job in /sitemap.xml (~41,000 URLs: id and title slug) and each job page carries
// schema.org JobPosting data (description, date posted, employer, location, pay). So: read the sitemap, keep only
// professional and management titles, fetch only the jobs the board does not hold yet, run them through the board's own
// import screen (US only, seniority floor, no internships), and write them as direct listings. Jobs still in the
// sitemap are re-confirmed (so they stay on the board); jobs that left it are archived.
//
// robots.txt allows only named search engines; the owner chose to crawl anyway (2026-11-13). The crawler identifies
// itself, fetches a few pages at a time and stops at a time budget, so a run is bounded and the next run continues.
//
// Database reads per run: one range read of this feed's rows by url prefix (about 6,000 rows, id, url and archivedAt
// only) and the company links for new jobs. Writes: re-confirmations in batches of 1,000, up to MAX_NEW_PER_RUN inserts.

const SITEMAP_URL = 'https://www.governmentjobs.com/sitemap.xml'
const JOB_URL_PREFIX = 'https://www.governmentjobs.com/jobs/'
const USER_AGENT = 'NextChapterResearch/1.0 (+https://launchyournextchapter.com/reports)'
const ADDED_BY = 'neogov_feed'
const MIN_SITEMAP_JOBS = 20_000 // a short or broken sitemap must not archive real postings
const MAX_NEW_PER_RUN = 1500
const TIME_BUDGET_MS = 200_000
const WORKERS = 6
const FETCH_TIMEOUT_MS = 15_000
const THIRTY_DAYS_MS = 30 * 86_400_000
const YEAR_MS = 365 * 86_400_000 // the board hides direct listings older than this

// A title must name a professional or management role and must not be a trade, service, protective, clerical or labor role.
// Quality over volume: a white-collar job with an unusual title is skipped rather than let a blue-collar one in.
const NOT_WHITE_COLLAR = new RegExp(String.raw`\b(custodi\w+|janitor\w*|housekeep\w*|groundskeep\w*|labor\w*|mechanic\w*|welder|carpent\w*|painter|plumb\w*|electrician|hvac|line ?(man|worker|crew)|operator|operations? (aide|assistant)|heavy equipment|driver|chauffeur|refuse|sanitation|landfill|solid waste|crew|tree|arborist|forest(er)? (tech|aide)|firefighter|fire ?fighter|police|patrol|deputy|sheriff|correction\w*|detention|jail\w*|dispatch\w*|telecommunicator|lifeguard|cook|chef|baker|food|dietary|cafeteria|cashier|server|bartender|usher|seasonal|temporary|part[- ]time|substitute|sub|crossing guard|aide|attendant|assistant|clerk|clerical|receptionist|secretary|typist|data entry|mail|warehouse|stock\w*|courier|trades?|utility|maintenance|repair\w*|facilit\w*|custody|guard|security|ranger|lookout|laundry|meter|kennel|animal (care|control|shelter)|field (tech|worker|aide)|technician|tech|installer|inspector aide|worker|helper|apprentice|trainee|intern|student|volunteer|pool|on call|on-call|parking|gym|fitness|activities|pt|extra help|stipend|coach|referee|umpire|scorekeeper|paraprofessional|paraeducator|nursing assistant|cna|lpn|medical (assistant|records)|patient (care|support)|orderly|phlebotom\w*|pharmacy tech\w*|radiologic tech\w*|sterile)\b`, 'i')
const PROFESSIONAL = new RegExp(String.raw`\b(analyst|engineer\w*|manager|director|administrator|accountant|accounting|auditor|actuary|economist|statistician|planner|coordinator|specialist|architect|attorney|counsel|paralegal|legal|judge|magistrate|nurse|physician|psychiatrist|psychologist|pharmacist|dentist|veterinarian|therapist|dietitian|epidemiologist|social worker|counselor|clinician|librarian|archivist|curator|teacher|professor|lecturer|faculty|instructor|dean|provost|principal|superintendent|programmer|developer|software|devops|cyber\w*|network|database|gis|data|web|systems?|scientist|biologist|chemist|geologist|hydrologist|researcher|research|investigator|appraiser|assessor|surveyor|designer|writer|editor|producer|buyer|procurement|purchasing|contract\w*|grants?|budget|fiscal|finance|financial|treasurer|controller|payroll|human resources|hr|recruiter|compliance|risk|policy|program|project|consultant|advisor|adviser|liaison|executive|chief|president|vice president|administrator|supervisor|officer|communications?|public information|marketing|outreach|public health|health educator|caseworker|case manager|probation|parole|registrar|recorder|commissioner|ombudsman|strategist|strategy|operations)\b`, 'i')
const STILL_PROFESSIONAL = /\b(director|manager|chief|superintendent|attorney|counsel|engineer\w*|analyst|administrator|principal|dean|professor|teacher|librarian|accountant|physician|nurse)\b/
const SUPPORT_ROLE = /\b(police|fire|correction\w*|detention|jail\w*|sheriff|deputy|custodi\w+|mechanic\w*|maintenance|operator|driver|laborer|assistant)\b.*\b(officer|supervisor|technician|worker|specialist|aide|assistant|operator)\b/

export function isRelevantTitle(title: string): boolean {
  const t = title.toLowerCase()
  if (NOT_WHITE_COLLAR.test(t) && !STILL_PROFESSIONAL.test(t)) return false
  if (SUPPORT_ROLE.test(t)) return false
  return PROFESSIONAL.test(t)
}

export interface SitemapJob { id: string; url: string; title: string }

export function parseSitemap(xml: string): SitemapJob[] {
  const out: SitemapJob[] = []
  for (const m of xml.matchAll(/<loc>(https:\/\/www\.governmentjobs\.com\/jobs\/(\d+-\d+)\/([^<]*))<\/loc>/g)) {
    out.push({ id: m[2], url: m[1], title: m[3].replace(/-/g, ' ') })
  }
  return out
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
}
function htmlToText(html: string): string {
  return decodeEntities(decodeEntities(html).replace(/<\/(p|div|li|h\d|tr)>|<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim()
}

export interface NeogovPosting {
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

/** The JobPosting JSON-LD block of a job page, as a posting; null when the page has none. */
export function parseJobPage(page: string): NeogovPosting | null {
  let posting: Record<string, unknown> | null = null
  for (const m of page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1])
      if (d && typeof d === 'object' && d['@type'] === 'JobPosting') { posting = d; break }
    } catch { /* not this block */ }
  }
  if (!posting || typeof posting.title !== 'string' || !posting.title.trim()) return null
  const place = posting.jobLocation as { address?: Record<string, string> } | { address?: Record<string, string> }[] | undefined
  const addr = (Array.isArray(place) ? place[0]?.address : place?.address) ?? {}
  const state = /^[A-Z]{2}$/.test(addr.addressRegion ?? '') ? addr.addressRegion : null
  let city = (addr.addressLocality ?? '').split(',')[0].trim()
  if (/\d{5}/.test(city)) city = ''
  const location = [city, state].filter(Boolean).join(', ') || null
  const value = ((posting.baseSalary as { value?: { minValue?: number; maxValue?: number; unitText?: string } } | undefined)?.value) ?? {}
  const yearly = String(value.unitText ?? '').toUpperCase() === 'YEAR' && Number(value.minValue) > 0
  const posted = typeof posting.datePosted === 'string' ? new Date(posting.datePosted) : null
  const type = typeof posting.employmentType === 'string' ? posting.employmentType : null
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

async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xml' } })
    return res.ok ? await res.text() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export interface NeogovFeedResult {
  sitemapJobs: number
  relevant: number
  confirmed: number
  archived: number
  candidates: number
  fetched: number
  created: number
  skippedByScreen: number
  skippedOld: number
  stoppedAtBudget: boolean
  note?: string
}

export async function runNeogovFeed(): Promise<NeogovFeedResult> {
  const started = Date.now()
  const empty: NeogovFeedResult = { sitemapJobs: 0, relevant: 0, confirmed: 0, archived: 0, candidates: 0, fetched: 0, created: 0, skippedByScreen: 0, skippedOld: 0, stoppedAtBudget: false }
  const xml = await fetchText(SITEMAP_URL, 90_000)
  const jobs = xml ? parseSitemap(xml) : []
  if (jobs.length < MIN_SITEMAP_JOBS) return { ...empty, sitemapJobs: jobs.length, note: 'sitemap missing or short: nothing changed' }
  const inSitemap = new Set(jobs.map((j) => j.url))

  const existing = await prisma.exclusiveJobPosting.findMany({
    where: { url: { gte: JOB_URL_PREFIX, lt: JOB_URL_PREFIX + '￿', startsWith: JOB_URL_PREFIX }, addedBy: ADDED_BY },
    select: { id: true, url: true, archivedAt: true },
  })
  const known = new Set(existing.map((e) => e.url))
  const live = existing.filter((e) => !e.archivedAt)
  const stay = live.filter((e) => inSitemap.has(e.url)).map((e) => e.id)
  const gone = live.filter((e) => !inSitemap.has(e.url)).map((e) => e.id)

  const now = new Date()
  const expiresAt = new Date(now.getTime() + THIRTY_DAYS_MS)
  for (let i = 0; i < stay.length; i += 1000) {
    await prisma.exclusiveJobPosting.updateMany({
      where: { id: { in: stay.slice(i, i + 1000) } },
      data: { expiresAt, lastConfirmedAt: now, lastVerifiedAt: now },
    })
  }
  for (let i = 0; i < gone.length; i += 1000) {
    await prisma.exclusiveJobPosting.updateMany({ where: { id: { in: gone.slice(i, i + 1000) } }, data: { archivedAt: now } })
  }

  const relevant = jobs.filter((j) => isRelevantTitle(j.title))
  const candidates = relevant
    .filter((j) => !known.has(j.url))
    // The same US and seniority screen on the slug title alone, so jobs the board would drop are not fetched.
    .filter((j) => screenImportedJob(j.title, 'United States').keep)
    .slice(0, MAX_NEW_PER_RUN)

  const kept: { posting: NeogovPosting; url: string; level: string; location: string | null }[] = []
  let fetched = 0, skippedByScreen = 0, skippedOld = 0, stoppedAtBudget = false
  let next = 0
  const worker = async () => {
    while (next < candidates.length) {
      if (Date.now() - started > TIME_BUDGET_MS) { stoppedAtBudget = true; return }
      const job = candidates[next++]
      const page = await fetchText(job.url, FETCH_TIMEOUT_MS)
      const posting = page ? parseJobPage(page) : null
      if (!posting || !posting.employer) continue
      fetched += 1
      const verdict = screenImportedJob(posting.title, posting.location, { companyName: posting.employer, description: posting.description })
      if (!verdict.keep) { skippedByScreen += 1; continue }
      if (posting.postedAt && now.getTime() - posting.postedAt.getTime() > YEAR_MS) { skippedOld += 1; continue }
      kept.push({ posting, url: job.url, level: verdict.level, location: verdict.location })
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker))

  let created = 0
  if (kept.length > 0) {
    const companyIds = await linkPostingsToCompanies(kept.map((k) => k.posting.employer))
    const result = await prisma.exclusiveJobPosting.createMany({
      skipDuplicates: true,
      data: kept.map(({ posting, url, level, location }) => ({
        title: posting.title,
        companyName: posting.employer,
        companyId: companyIds.get(posting.employer) ?? null,
        location,
        url,
        description: fullDescriptionOf(posting.description),
        skills: skillsFrom(posting.title, posting.description),
        level,
        sourceCategory: 'public_sector',
        postingType: 'direct',
        directListing: true,
        source: 'ats_feed',
        status: 'approved',
        addedBy: ADDED_BY,
        sourceName: 'NEOGOV',
        salaryMin: posting.salaryMin,
        salaryMax: posting.salaryMax,
        salaryCurrency: posting.salaryMin ? 'USD' : null,
        payPeriod: posting.salaryMin ? 'year' : null,
        paySource: posting.salaryMin ? 'posted' : null,
        employmentType: posting.employmentType,
        locationStates: posting.state ? [posting.state] : [],
        postedAt: posting.postedAt,
        expiresAt,
        lastConfirmedAt: now,
        lastVerifiedAt: now,
      })),
    })
    created = result.count
  }

  return {
    sitemapJobs: jobs.length, relevant: relevant.length, confirmed: stay.length, archived: gone.length,
    candidates: candidates.length, fetched, created, skippedByScreen, skippedOld, stoppedAtBudget,
  }
}
