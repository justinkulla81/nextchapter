import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { aliasCompanyIds } from '@/lib/companies/company-alias'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  atsJobIdFromUrl,
  matchApplicationToPosting,
  type MatchablePosting,
  type PostingMatch,
  type PostingMatchOutcome,
} from '@/lib/jobs/application-posting-match'

// DB side of linking applications (JobPosting) to board postings
// (ExclusiveJobPosting). The matching rules are in application-posting-match.ts.
//
// The link lives on the application: boardJobId, boardMatchMethod
// ('board_card' | 'url' | 'ats_id' | 'company_title' | 'ambiguous' | 'none'),
// boardMatchConfidence (0–1) and boardMatchedAt. Those columns are @ignore'd in
// the Prisma schema and added by hand (prisma/manual/2026-10-16-application-board-link.sql),
// so every read and write here is raw SQL and only runs once they exist. Until
// then matching still works — callers get the links computed live — it just
// isn't stored.
//
// Runs at tracking time (Gmail-detected and hand-added applications, the board's
// "I applied") and lazily for any application never matched — the admin
// application-fit view links those on load, which doubles as the backfill.
// scripts/backfill-application-board-links.ts re-runs it on demand.

export type StoredMatchMethod = PostingMatchOutcome | 'board_card'

export interface ApplicationLink {
  postingId: string | null
  method: StoredMatchMethod
  confidence: number | null
}

export interface LinkableApplication {
  id: string
  candidateId: string
  url: string | null
  title: string | null
  companyName: string | null
  location?: string | null
  appliedAt: Date | null
  createdAt: Date
  trackedJob?: { source: string; sourceId: string } | null
}

// ── Schema readiness ─────────────────────────────────────────────────────────

let ready: { at: number; value: boolean } | null = null
/** Whether JobPosting has the board-link columns yet. True is cached for good; false is re-checked every 5 minutes. */
export async function boardLinkColumnsReady(): Promise<boolean> {
  if (ready && (ready.value || Date.now() - ready.at < 5 * 60_000)) return ready.value
  try {
    const rows = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'JobPosting'
        AND column_name IN ('boardJobId', 'boardMatchMethod', 'boardMatchConfidence', 'boardMatchedAt')`
    ready = { at: Date.now(), value: rows[0]?.n === 4 }
  } catch (err) {
    console.error('[application-posting-link] schema check failed', err)
    ready = { at: Date.now(), value: false }
  }
  return ready.value
}

// ── Employer → directory companies ───────────────────────────────────────────

// Sender domains that belong to an ATS, a job board or a mail provider, never the employer.
const NOT_EMPLOYER_DOMAINS = [
  'linkedin.com', 'indeed.com', 'indeedemail.com', 'greenhouse-mail.io', 'greenhouse.io', 'lever.co', 'hire.lever.co',
  'ashbyhq.com', 'myworkday.com', 'myworkdayjobs.com', 'workday.com', 'smartrecruiters.com', 'workablemail.com',
  'workable.com', 'bamboohr.com', 'applytojob.com', 'jazzhr.com', 'icims.com', 'jobvite.com', 'taleo.net',
  'successfactors.com', 'oraclecloud.com', 'ultipro.com', 'paylocity.com', 'adp.com', 'paycomonline.net',
  'theladders.com', 'jobgether.com', 'comeet-notifications.com', 'submittable.com', 'newtonsoftware.com',
  'ziprecruiter.com', 'glassdoor.com', 'dice.com', 'wellfound.com', 'gmail.com', 'outlook.com', 'yahoo.com',
  'hotmail.com', 'veracross.com', 'teamtailor.com', 'recruitee.com', 'breezy.hr', 'pinpointhq.com', 'rippling.com',
  'careeronestop.org', 'substack.com', 'skeeled.com', 'clearcompany.com',
]

/** "Name <jobs@mail.acme.com>" → "acme.com"; null for an ATS / board / mail-provider sender. */
export function employerDomain(fromAddress: string | null | undefined): string | null {
  const m = fromAddress?.toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})/)
  if (!m) return null
  const host = m[1]
  if (NOT_EMPLOYER_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`))) return null
  return registrableDomain(host)
}

function registrableDomain(host: string): string {
  const parts = host.replace(/^www\./, '').split('.')
  // acme.co.uk, acme.com.au — keep three labels when the second-to-last is a generic SLD.
  const keep = parts.length >= 3 && /^(co|com|org|net|ac|gov|edu)$/.test(parts[parts.length - 2]) && parts[parts.length - 1].length === 2 ? 3 : 2
  return parts.slice(-keep).join('.')
}

function websiteDomain(website: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`)
    return registrableDomain(u.hostname.toLowerCase())
  } catch {
    return null
  }
}

// Directory companies per application: exact normalized name, a confirmed alias,
// the name with its spaces squeezed out when exactly one company matches
// ("Purestorage" → Pure Storage), and the confirmation email's sender domain
// against Company.website.
async function resolveCompanies(apps: LinkableApplication[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>()
  const withName = apps.filter((a) => a.companyName && normalizeOrgName(a.companyName))
  const norms = [...new Set(withName.map((a) => normalizeOrgName(a.companyName!)))]
  const squished = [...new Set(norms.map((n) => n.replace(/\s+/g, '')).filter((s) => s.length >= 5))]

  const [exact, aliases, squishRows, emails, websites] = await Promise.all([
    norms.length
      ? prisma.company.findMany({ where: { canonicalNameNormalized: { in: norms } }, select: { id: true, canonicalNameNormalized: true } })
      : [],
    aliasCompanyIds(norms),
    squished.length
      ? prisma.$queryRaw<{ id: string; squished: string }[]>`
          SELECT id, replace("canonicalNameNormalized", ' ', '') AS squished FROM "Company"
          WHERE replace("canonicalNameNormalized", ' ', '') IN (${Prisma.join(squished)})`
      : [],
    withName.length
      ? prisma.trackedEmailActivity.findMany({
          where: {
            candidateId: { in: [...new Set(withName.map((a) => a.candidateId))] },
            activityType: 'APPLICATION_CONFIRMATION',
            companyName: { in: [...new Set(withName.map((a) => a.companyName!))] },
            fromAddress: { not: null },
          },
          select: { candidateId: true, companyName: true, fromAddress: true, detectedAt: true },
        })
      : [],
    prisma.company.findMany({ where: { website: { not: null } }, select: { id: true, website: true } }),
  ])

  const byNorm = new Map(exact.map((c) => [c.canonicalNameNormalized, c.id]))
  const bySquish = new Map<string, string[]>()
  for (const r of squishRows) bySquish.set(r.squished, [...(bySquish.get(r.squished) ?? []), r.id])
  const byDomain = new Map<string, string[]>()
  for (const w of websites) {
    const d = w.website ? websiteDomain(w.website) : null
    if (d) byDomain.set(d, [...(byDomain.get(d) ?? []), w.id])
  }

  for (const a of withName) {
    const norm = normalizeOrgName(a.companyName!)
    const ids = new Set<string>()
    const exactId = byNorm.get(norm)
    if (exactId) ids.add(exactId)
    const aliasId = aliases.get(norm)
    if (aliasId) ids.add(aliasId)
    if (ids.size === 0) {
      const sq = bySquish.get(norm.replace(/\s+/g, ''))
      if (sq?.length === 1) ids.add(sq[0])
    }
    // The confirmation email nearest the apply date, when it came from the employer's own domain.
    const when = (a.appliedAt ?? a.createdAt).getTime()
    const mail = emails
      .filter((e) => e.candidateId === a.candidateId && e.companyName === a.companyName)
      .sort((x, y) => Math.abs(x.detectedAt.getTime() - when) - Math.abs(y.detectedAt.getTime() - when))[0]
    const domain = employerDomain(mail?.fromAddress)
    const byMail = domain ? byDomain.get(domain) : undefined
    if (byMail?.length === 1) ids.add(byMail[0])
    if (ids.size) out.set(a.id, [...ids])
  }
  return out
}

// ── Candidate postings ───────────────────────────────────────────────────────

const POSTING_SELECT = {
  id: true, url: true, title: true, location: true, companyId: true, externalJobId: true, requisitionId: true,
  repostKey: true, descHash: true, postedAt: true, createdAt: true, archivedAt: true, closeReason: true,
} as const

// Raw URL spellings worth an exact lookup on the unique url index.
function urlVariants(raw: string): string[] {
  const s = raw.trim()
  const out = new Set([s])
  try {
    const u = new URL(s)
    u.hash = ''
    const base = `${u.origin}${u.pathname}`
    out.add(base)
    out.add(base.replace(/\/+$/, ''))
    out.add(`${base.replace(/\/+$/, '')}/`)
    out.add(base.replace('://www.', '://'))
    if (!u.hostname.startsWith('www.')) out.add(base.replace('://', '://www.'))
    out.add(base.replace(/\/(apply|application)\/?$/i, ''))
  } catch {
    /* not a URL — the exact spelling only */
  }
  return [...out]
}

const PER_COMPANY_CAP = 5000

// Every posting an application could match: by URL spelling, by ATS id, and the
// employer's postings. Archived / closed postings included on purpose.
async function loadCandidatePostings(apps: LinkableApplication[], companies: Map<string, string[]>): Promise<MatchablePosting[]> {
  const urls = [...new Set(apps.flatMap((a) => (a.url ? urlVariants(a.url) : [])))]
  const atsIds = [...new Set(apps.map((a) => atsJobIdFromUrl(a.url)?.id).filter((id): id is string => !!id))]
  const companyIds = [...new Set([...companies.values()].flat())]
  // externalJobId / requisitionId are indexed by the same manual SQL file that adds
  // the link columns; until then the id lookup is skipped rather than scan the board.
  const idLookup = atsIds.length > 0 && (await boardLinkColumnsReady())
  const [byUrl, byId, byCompany] = await Promise.all([
    urls.length ? prisma.exclusiveJobPosting.findMany({ where: { url: { in: urls } }, select: POSTING_SELECT }) : [],
    idLookup
      ? prisma.exclusiveJobPosting.findMany({
          where: { OR: [{ externalJobId: { in: atsIds } }, { requisitionId: { in: atsIds } }] },
          select: POSTING_SELECT,
          take: 500,
        })
      : [],
    companyIds.length
      ? prisma.exclusiveJobPosting.findMany({
          where: { companyId: { in: companyIds } },
          select: POSTING_SELECT,
          orderBy: { createdAt: 'desc' },
          take: PER_COMPANY_CAP * Math.min(companyIds.length, 10),
        })
      : [],
  ])
  return [...new Map([...byUrl, ...byId, ...byCompany].map((p) => [p.id, p])).values()]
}

// ── Matching ─────────────────────────────────────────────────────────────────

/** The board posting behind each application (computed, not read from storage). */
export async function matchApplications(apps: LinkableApplication[]): Promise<Map<string, ApplicationLink & { match?: PostingMatch }>> {
  const out = new Map<string, ApplicationLink & { match?: PostingMatch }>()
  const rest: LinkableApplication[] = []
  for (const a of apps) {
    // Applied from a board card: the card is the posting.
    if (a.trackedJob?.source === 'job_board') out.set(a.id, { postingId: a.trackedJob.sourceId, method: 'board_card', confidence: 1 })
    else rest.push(a)
  }
  if (rest.length === 0) return out
  const companies = await resolveCompanies(rest)
  const postings = await loadCandidatePostings(rest, companies)
  for (const a of rest) {
    const companyIds = companies.get(a.id) ?? []
    const appliedAt = a.appliedAt ?? a.createdAt
    const match = matchApplicationToPosting({ url: a.url, title: a.title, location: a.location ?? null, appliedAt, companyIds }, postings)
    out.set(a.id, { postingId: match.postingId, method: match.outcome, confidence: match.confidence, match })
  }
  return out
}

// ── Storage ──────────────────────────────────────────────────────────────────

/** An unlinked result is re-tried after this long: a posting can reach the board after the member applied, and an analysed paste fills in the title. */
export const UNLINKED_RETRY_MS = 24 * 3600 * 1000

/**
 * Stored links for these applications — only rows that were matched, and (with
 * `fresh`) leaving out unlinked results older than a day so callers re-match
 * them. Empty until the columns exist.
 */
export async function readStoredLinks(appIds: string[], opts: { fresh?: boolean } = {}): Promise<Map<string, ApplicationLink>> {
  const out = new Map<string, ApplicationLink>()
  if (appIds.length === 0 || !(await boardLinkColumnsReady())) return out
  const rows: { id: string; boardJobId: string | null; boardMatchMethod: string; boardMatchConfidence: number | null; boardMatchedAt: Date }[] = []
  for (let i = 0; i < appIds.length; i += 1000) {
    rows.push(...(await prisma.$queryRaw<typeof rows>`
      SELECT id, "boardJobId", "boardMatchMethod", "boardMatchConfidence", "boardMatchedAt" FROM "JobPosting"
      WHERE id IN (${Prisma.join(appIds.slice(i, i + 1000))}) AND "boardMatchedAt" IS NOT NULL`))
  }
  const staleBefore = Date.now() - UNLINKED_RETRY_MS
  for (const r of rows) {
    if (opts.fresh && !r.boardJobId && r.boardMatchedAt.getTime() < staleBefore) continue
    out.set(r.id, { postingId: r.boardJobId, method: r.boardMatchMethod as StoredMatchMethod, confidence: r.boardMatchConfidence })
  }
  return out
}

/** Writes links (including 'ambiguous' / 'none', so they aren't re-tried on every load). No-op until the columns exist. */
export async function storeLinks(links: Map<string, ApplicationLink>): Promise<number> {
  if (links.size === 0 || !(await boardLinkColumnsReady())) return 0
  const rows = [...links.entries()]
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    await prisma.$executeRaw`
      UPDATE "JobPosting" AS jp SET
        "boardJobId" = v.job, "boardMatchMethod" = v.method,
        "boardMatchConfidence" = v.conf, "boardMatchedAt" = now()
      FROM (VALUES ${Prisma.join(
        chunk.map(([id, l]) => Prisma.sql`(${id}, ${l.postingId}::text, ${l.method}, ${l.confidence}::double precision)`),
      )}) AS v(id, job, method, conf)
      WHERE jp.id = v.id`
  }
  return rows.length
}

const LINK_SELECT = {
  id: true, candidateId: true, url: true, title: true, companyName: true, location: true, appliedAt: true, createdAt: true,
  trackedJob: { select: { source: true, sourceId: true } },
} as const

/**
 * Tracking-time hook: match one application and store the result. Never throws —
 * a failed match must not break recording the application.
 */
export async function linkApplicationToBoard(applicationId: string): Promise<ApplicationLink | null> {
  try {
    const app = await prisma.jobPosting.findUnique({ where: { id: applicationId }, select: LINK_SELECT })
    if (!app) return null
    const links = await matchApplications([app])
    const link = links.get(app.id) ?? null
    if (link) {
      await storeLinks(new Map([[app.id, { postingId: link.postingId, method: link.method, confidence: link.confidence }]]))
      captureServerEvent(app.candidateId, 'application_board_linked', {
        jobPostingId: app.id,
        boardJobId: link.postingId,
        method: link.method,
        confidence: link.confidence,
        candidates: link.match?.candidateIds.length ?? null,
      })
    }
    // Remember what the job asked for and how the member matched, now (skill-snapshot-data.ts).
    // Imported lazily: that module reads this one's stored links.
    const { snapshotApplication } = await import('@/lib/applications/skill-snapshot-data')
    await snapshotApplication(app.id, link ? { postingId: link.postingId } : null)
    return link
  } catch (err) {
    console.error('[application-posting-link] link failed', applicationId, err)
    return null
  }
}

/**
 * Backfill: re-match applied applications (all, or only never-matched ones) and
 * store the results when the columns exist. Returns the outcome counts.
 */
export async function backfillApplicationLinks(opts: { onlyUnmatched?: boolean; dryRun?: boolean } = {}) {
  const apps = await prisma.jobPosting.findMany({ where: { appliedAt: { not: null } }, select: LINK_SELECT, orderBy: { appliedAt: 'desc' } })
  let todo = apps
  if (opts.onlyUnmatched) {
    const stored = await readStoredLinks(apps.map((a) => a.id))
    todo = apps.filter((a) => !stored.has(a.id))
  }
  const counts: Record<StoredMatchMethod, number> = { board_card: 0, url: 0, ats_id: 0, company_title: 0, ambiguous: 0, none: 0 }
  const links = new Map<string, ApplicationLink>()
  // Batches keep each employer-postings read small.
  for (let i = 0; i < todo.length; i += 50) {
    const batch = await matchApplications(todo.slice(i, i + 50))
    for (const [id, l] of batch) {
      counts[l.method]++
      links.set(id, { postingId: l.postingId, method: l.method, confidence: l.confidence })
    }
  }
  const stored = opts.dryRun ? 0 : await storeLinks(links)
  return { applications: todo.length, counts, stored, links }
}

