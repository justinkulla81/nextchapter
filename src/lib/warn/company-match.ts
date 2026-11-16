import { prisma } from '@/lib/prisma'
import { sharedLoad } from '@/lib/db/heavy'
import { normalizeOrgName, orgNamesMatch, fixAllCapsCompanyName } from '@/lib/text/org-name-match'
import { strictOrgKey } from '@/lib/crm/normalize'
import { resolveAmbiguous } from './ambiguous-resolve'

export interface WarnCompanyMatchResult {
  companyId: string | null
  status: 'MATCHED' | 'AMBIGUOUS' | 'UNMATCHED'
  candidates: { id: string; name: string }[] | null
}

/**
 * Matches a WARN filing's employer to an existing Company, auto-creates one
 * when nothing plausible exists, or defers to a human when a loose match
 * found candidates too uncertain to link without risking a false merge —
 * a real ambiguity gets a review queue, not a guess.
 *
 * Two-tier matching mirrors promoteNotice()'s existing CrmOrganization logic:
 * strictOrgKey (strips the trailing "(1655 3rd Street)" location parenthetical
 * WARN filings often carry, plus legal suffixes) for a confident auto-link,
 * then the looser orgNamesMatch containment check for "maybe, ask a human."
 */
/**
 * Every company, read once for a whole import.
 *
 * Matching used to re-read the full company table for each notice. At a few
 * thousand companies and a few hundred notices that was most of an import's
 * runtime, and what pushed the weekly sync past its time limit.
 */
export type CompanyIndex = { id: string; name: string }[]

/**
 * The index comes from Vercel's shared data cache, kept six hours, in INDEX_PARTS pieces (an entry is capped at 2 MB), plus the companies
 * created since it was read. Every caller read the whole table (~114k rows) itself: the hourly layoff-news check, the layoffs inbox and the
 * WARN syncs each start on a cold instance, so it ran ~5 times an hour and was the largest single source of egress on 2026-11-16. A cached
 * id that no longer exists (a merged company) is caught in matchOrCreateCompanyForEmployer, which then reads the table fresh once.
 */
const INDEX_PARTS = 6
const INDEX_TTL_SEC = 6 * 3600
type IndexPart = { at: string; rows: [string, string][] }

async function loadIndexPart(part: number): Promise<IndexPart> {
  const at = new Date().toISOString()
  const rows = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT id, name FROM "Company" WHERE (hashtext(id) & 2147483647) % ${INDEX_PARTS}::int = ${part}::int`
  return { at, rows: rows.map((r) => [r.id, r.name]) }
}

export async function loadCompanyIndex(): Promise<CompanyIndex> {
  const parts = await Promise.all(
    Array.from({ length: INDEX_PARTS }, (_, k) => sharedLoad(`company-index-v1:${k}`, INDEX_TTL_SEC, () => loadIndexPart(k), { reviveDates: false }))
  )
  // Companies created after the oldest piece was read (a minute of slack for clocks); they replace any cached row with the same id.
  const since = new Date(Math.min(...parts.map((p) => Date.parse(p.at))) - 60_000)
  const fresh = await prisma.company.findMany({ where: { createdAt: { gte: since } }, select: { id: true, name: true } })
  const byId = new Map<string, string>()
  for (const p of parts) for (const [id, name] of p.rows) byId.set(id, name)
  for (const c of fresh) byId.set(c.id, c.name)
  return [...byId].map(([id, name]) => ({ id, name }))
}

/** The whole table straight from the database: only when the cached index named a company that no longer exists. */
async function loadCompanyIndexFresh(): Promise<CompanyIndex> {
  return prisma.company.findMany({ select: { id: true, name: true } })
}

// Callers that match one employer at a time (announcements, news checks, the admin form) passed no index, so each match re-read the
// whole company table. They share one copy for ten minutes instead; a company created here is added to it at once.
let sharedIndex: { at: number; index: Promise<CompanyIndex> } | null = null
function sharedCompanyIndex(): Promise<CompanyIndex> {
  if (!sharedIndex || Date.now() - sharedIndex.at > 10 * 60_000) {
    const index = loadCompanyIndex()
    sharedIndex = { at: Date.now(), index }
    index.catch(() => { if (sharedIndex?.index === index) sharedIndex = null })
  }
  return sharedIndex.index
}

export async function matchOrCreateCompanyForEmployer(rawEmployer: string, index?: CompanyIndex): Promise<WarnCompanyMatchResult> {
  const result = await matchOrCreate(rawEmployer, index)
  if (!result.companyId) return result
  // The index can be up to six hours old: a company merged away since then is matched by an id that is gone. Read fresh once and redo.
  const exists = await prisma.company.findUnique({ where: { id: result.companyId }, select: { id: true } })
  if (exists) return result
  const freshIndex = await loadCompanyIndexFresh()
  if (sharedIndex) sharedIndex = { at: Date.now(), index: Promise.resolve(freshIndex) }
  return matchOrCreate(rawEmployer, freshIndex)
}

async function matchOrCreate(rawEmployer: string, index?: CompanyIndex): Promise<WarnCompanyMatchResult> {
  const employer = fixAllCapsCompanyName(rawEmployer.trim())
  const strictKey = strictOrgKey(employer, normalizeOrgName)
  if (!strictKey) return { companyId: null, status: 'UNMATCHED', candidates: null }

  const companies = index ?? (await sharedCompanyIndex())

  const strictMatch = companies.find((c) => strictOrgKey(c.name, normalizeOrgName) === strictKey)
  if (strictMatch) return { companyId: strictMatch.id, status: 'MATCHED', candidates: null }

  let created_from_review: { id: string; name: string }[] | null = null
  const looseMatches = companies.filter((c) => orgNamesMatch(c.name, employer))
  if (looseMatches.length > 0) {
    // Containment alone finds "Meta" inside "Metallics". Whole-word rules settle the clear cases (a site or legal tail on a known
    // company, or no real relation at all); only what they cannot decide waits for a person.
    const candidates = looseMatches.map((c) => ({ id: c.id, name: c.name }))
    const res = resolveAmbiguous(employer, candidates)
    if (res.kind === 'match') return { companyId: res.id, status: 'MATCHED', candidates: null }
    // Undecided: it gets its own company rather than waiting on a person. Every employer has a page, so a wrong guess either way is worse than a
    // twin that can be merged later; the candidates stay on the result for whoever looks.
    if (res.kind === 'review') created_from_review = candidates
  }

  // Genuinely new employer. Strip the location parenthetical before storing —
  // strictOrgKey already ignores it for matching, but the Company's own
  // display name should be the employer, not one of its addresses.
  const cleanName = employer.replace(/\s*\([^)]*\)\s*$/, '').trim() || employer
  const canonicalNameNormalized = normalizeOrgName(cleanName)
  const created = await prisma.company.upsert({
    where: { canonicalNameNormalized },
    update: {},
    create: { name: cleanName, canonicalNameNormalized },
    select: { id: true, name: true },
  })
  // So the next notice from the same employer in this import finds it.
  if (!companies.some((c) => c.id === created.id)) companies.push({ id: created.id, name: created.name })
  return { companyId: created.id, status: 'MATCHED', candidates: created_from_review }
}
