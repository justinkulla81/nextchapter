import 'server-only'
import { prisma } from '@/lib/prisma'
import { Prisma, type WarnNotice } from '@prisma/client'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  LAYOUTS, MAX_AGE_DAYS, MAX_EMPLOYEES, MIN_EMPLOYEES, RECENT_DRAFT_DAYS, WEEKLY_CAP,
  assignSlots, credibilityOf, plausibleEmployer, draftText, eligibleAngles, leastRecent, rankScore, sameEvent,
  type Angle, type Credibility, type DraftFacts, type EventRef,
} from './layoff-post-rules'

const SENIOR = ['EXECUTIVE', 'VP', 'DIRECTOR', 'SENIOR_MANAGER', 'MANAGER']

export interface DraftSweepResult {
  considered: number
  credible: number
  created: { employer: string; scheduledFor: Date }[]
  /** Credible notices left for a later run because the week's cap is used. */
  deferred: number
}

/**
 * Turns credible, recent layoffs into suggested LinkedIn posts, and stages each
 * at a weekday slot so a busy news day spreads out instead of landing at once.
 * Runs at the end of the layoff-news cron (every three hours) and is
 * idempotent: a notice that already has a draft is skipped, and a notice that
 * is not yet credible is looked at again next run, when a second publisher may
 * have reported it. No model call is made here; the wording is the template
 * text, which the morning rewrite replaces for the posts worth sending.
 */
export async function runLinkedInDraftSweep(now = new Date()): Promise<DraftSweepResult> {
  const result: DraftSweepResult = { considered: 0, credible: 0, created: [], deferred: 0 }
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000)

  const candidates = await prisma.warnNotice.findMany({
    where: {
      linkedinDraft: null, dismissedAt: null,
      employees: { gte: MIN_EMPLOYEES, lte: MAX_EMPLOYEES },
      fetchedAt: { gte: new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000) },
    },
    orderBy: { employees: 'desc' },
    take: 150,
  })
  result.considered = candidates.length
  if (candidates.length === 0) return result

  const mentions = await prisma.layoffNewsMention.findMany({
    where: { noticeId: { in: candidates.map((n) => n.id) } },
    select: { noticeId: true, publisher: true },
  })
  const scored = candidates.flatMap((n) => {
    const why = credibilityOf(n, mentions.filter((m) => m.noticeId === n.id).map((m) => m.publisher), now)
    return why ? [{ n, why }] : []
  })
  // Our audience is US job seekers: a state filing and an SEC filing are US by
  // nature; a news story counts only when the employer has US jobs on our board
  // or is already in the CRM, so a foreign bank or a misread name never gets a post.
  const relevance = await usRelevance(scored.filter((c) => c.n.source !== 'WARN_FILING' && c.why !== 'sec-filing').map((c) => c.n))
  const eligible = scored
    .filter((c) => c.n.source === 'WARN_FILING' || c.why === 'sec-filing' || relevance.get(c.n.id))
    .map((c) => ({ ...c, rank: rankScore(c.why, c.n.employees ?? 0, !!relevance.get(c.n.id)?.inCrm) }))
    .sort((x, y) => y.rank - x.rank)

  const [madeThisWeek, waiting, recent, lately] = await Promise.all([
    prisma.linkedInPostDraft.count({ where: { createdAt: { gte: weekAgo }, status: { not: 'SKIPPED' } } }), // a skipped draft frees its slot
    prisma.linkedInPostDraft.findMany({ where: { status: 'DRAFT', scheduledFor: { gte: now } }, select: { scheduledFor: true } }),
    prisma.linkedInPostDraft.findMany({ orderBy: { createdAt: 'desc' }, take: 20, select: { angle: true, layout: true } }),
    prisma.linkedInPostDraft.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - RECENT_DRAFT_DAYS * 86_400_000) } },
      select: { facts: true },
    }),
  ])
  // One post per layoff: drop a notice that repeats a draft already made or a
  // higher-ranked notice in this batch (Kroger and Kroger’s, NAB and National Australia Bank).
  const seen: EventRef[] = lately.map((d) => {
    const f = d.facts as unknown as DraftFacts
    return { employer: f.employer, employees: f.employees, date: f.noticeDate ? new Date(f.noticeDate) : null }
  })
  const credible = eligible.filter(({ n }) => {
    const ref: EventRef = { employer: n.employer, employees: n.employees, date: n.noticeDate }
    if (seen.some((s) => sameEvent(s, ref))) return false
    seen.push(ref)
    return true
  })
  result.credible = credible.length

  const room = Math.max(0, WEEKLY_CAP - madeThisWeek)
  const chosen = credible.slice(0, room)
  result.deferred = credible.length - chosen.length
  if (chosen.length === 0) return result

  const slots = assignSlots(chosen.length, waiting.map((w) => w.scheduledFor), now)
  const recentAngles: string[] = recent.map((r) => r.angle)
  const recentLayouts: number[] = recent.map((r) => r.layout)

  for (const [i, { n, why }] of chosen.entries()) {
    const scheduledFor = slots[i]
    if (!scheduledFor) { result.deferred++; continue }

    const made = await createDraft(n, why, scheduledFor, recentAngles, recentLayouts)
    if (!made) continue // another run made it first
    result.created.push({ employer: n.employer, scheduledFor })
  }
  return result
}

/**
 * Builds and saves one draft: facts and stats, an angle and image layout not
 * used lately, the template text. Returns false when the notice already has a
 * draft (another run made it first). Also used by the admin's "sample draft".
 * `recentAngles` and `recentLayouts` are newest first and are updated in place.
 */
export async function createDraft(
  n: WarnNotice, why: Credibility, scheduledFor: Date, recentAngles: string[], recentLayouts: number[],
): Promise<boolean> {
  const state = n.state
  const [openRolesInState, openSeniorRolesInState, tagSuggestions] = await Promise.all([
    state ? prisma.companyJobOpening.count({ where: { closedAt: null, states: { has: state } } }) : Promise.resolve(null),
    state ? prisma.companyJobOpening.count({ where: { closedAt: null, states: { has: state }, seniorityGroup: { in: SENIOR } } }) : Promise.resolve(null),
    tagSuggestionsFor(n.promotedOrgId, n.normalizedEmployer, n.workforceBoardId),
  ])
  const facts: DraftFacts = {
    employer: n.employer, employees: n.employees ?? 0,
    percent: percentFrom(n.layoffType),
    place: n.county && state ? `${n.county.replace(/ county$/i, '')} County, ${state}` : state,
    state, noticeDate: n.noticeDate?.toISOString() ?? null, effectiveDate: n.effectiveDate?.toISOString() ?? null,
    industry: n.industry, sourceUrl: n.sourceUrl, credibility: why,
    openRolesInState, openSeniorRolesInState, tagSuggestions,
  }
  const angle = leastRecent<Angle>(eligibleAngles(facts), recentAngles as Angle[], n.id)
  const layout = leastRecent(LAYOUTS.map((_, k) => k), recentLayouts, n.id)
  const text = draftText(angle, facts, n.id)
  try {
    await prisma.linkedInPostDraft.create({
      data: {
        noticeId: n.id, angle, layout, body: text.body, firstComment: text.firstComment,
        scheduledFor, facts: facts as unknown as Prisma.InputJsonValue, credibility: why,
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return false
    throw e
  }
  recentAngles.unshift(angle)
  recentLayouts.unshift(layout)
  captureServerEvent('cron', 'linkedin_draft_created', {
    noticeId: n.id, employer: n.employer, employees: n.employees, angle, layout, credibility: why, scheduledFor: scheduledFor.toISOString(),
  })
  return true
}

export interface DraftableLayoff {
  noticeId: string
  employer: string
  employees: number
  place: string | null
  noticeDate: Date | null
  /** Why it would pass the gate, or null when it would not. */
  credibility: Credibility | null
  /** Two-letter US state, from the filing or the CRM record; null when unknown. */
  state: string | null
  /** Industry as published (WARN filings) or as resolved for the company; null when unknown. */
  industry: string | null
  /** What to double-check before posting, in plain words; empty when nothing looks off. */
  warnings: string[]
  sourceUrl: string | null
}

/**
 * Every recent layoff without a draft, deduped to one row per event, most
 * promising first, for the admin to pick from. The weekly cap and the
 * credibility gate only limit what the sweep drafts by itself; a person can
 * make a draft from any row here, and the warnings say what looks off.
 */
export async function listDraftableLayoffs(now = new Date(), days = 21): Promise<DraftableLayoff[]> {
  const notices = await prisma.warnNotice.findMany({
    where: { linkedinDraft: null, dismissedAt: null, employees: { gte: MIN_EMPLOYEES }, fetchedAt: { gte: new Date(now.getTime() - days * 86_400_000) } },
    orderBy: { employees: 'desc' },
    take: 150,
  })
  if (notices.length === 0) return []
  const mentions = await prisma.layoffNewsMention.findMany({
    where: { noticeId: { in: notices.map((n) => n.id) } },
    select: { noticeId: true, publisher: true },
  })
  const news = notices.filter((n) => n.source !== 'WARN_FILING' && !/^SEC 8-K/i.test(n.layoffType ?? ''))
  const relevance = await usRelevance(news)
  const [recent, companies, orgs] = await Promise.all([
    prisma.linkedInPostDraft.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - RECENT_DRAFT_DAYS * 86_400_000) } },
      select: { facts: true },
    }),
    prisma.company.findMany({ where: { id: { in: notices.flatMap((n) => (n.companyId ? [n.companyId] : [])) } }, select: { id: true, industry: true } }),
    prisma.crmOrganization.findMany({ where: { canonicalNameNormalized: { in: notices.map((n) => n.normalizedEmployer) } }, select: { canonicalNameNormalized: true, usState: true } }),
  ])
  const industryOf = new Map(companies.map((c) => [c.id, c.industry]))
  const stateOf = new Map(orgs.map((o) => [o.canonicalNameNormalized, o.usState]))
  const seen: EventRef[] = recent.map((d) => {
    const f = d.facts as unknown as DraftFacts
    return { employer: f.employer, employees: f.employees, date: f.noticeDate ? new Date(f.noticeDate) : null }
  })

  const rows = notices.map((n) => {
    // The age rule is the sweep's; for the picker only the facts about the layoff matter.
    const fresh = { ...n, fetchedAt: now }
    const credibility = credibilityOf(fresh, mentions.filter((m) => m.noticeId === n.id).map((m) => m.publisher), now)
    const isNews = news.includes(n)
    const warnings: string[] = []
    if (!plausibleEmployer(n.employer)) warnings.push('The company name looks wrong')
    if ((n.employees ?? 0) > MAX_EMPLOYEES) warnings.push('The job count looks too high for one company')
    if (!credibility && plausibleEmployer(n.employer) && (n.employees ?? 0) <= MAX_EMPLOYEES) warnings.push('Only one source so far')
    if (isNews && !relevance.get(n.id)) warnings.push('No US jobs or CRM record for this employer')
    const rank = (credibility ? rankScore(credibility, n.employees ?? 0, !!relevance.get(n.id)?.inCrm) : -1) - warnings.length * 0.01
    return { n, credibility, warnings, rank }
  }).sort((a, b) => b.rank - a.rank)

  const out: DraftableLayoff[] = []
  for (const { n, credibility, warnings } of rows) {
    const ref: EventRef = { employer: n.employer, employees: n.employees, date: n.noticeDate }
    if (seen.some((s) => sameEvent(s, ref))) continue
    seen.push(ref)
    out.push({
      noticeId: n.id, employer: n.employer, employees: n.employees ?? 0,
      place: n.county && n.state ? `${n.county.replace(/ county$/i, '')} County, ${n.state}` : n.state,
      noticeDate: n.noticeDate, credibility, warnings, sourceUrl: n.sourceUrl,
      state: n.state ?? stateOf.get(n.normalizedEmployer) ?? null,
      industry: n.industry ?? (n.companyId ? industryOf.get(n.companyId) ?? null : null),
    })
  }
  return out
}

/** Which news-sourced notices belong to a US employer: it has US jobs on the board, or is in the CRM. */
async function usRelevance(notices: WarnNotice[]): Promise<Map<string, { inCrm: boolean }>> {
  const out = new Map<string, { inCrm: boolean }>()
  if (notices.length === 0) return out
  const companyIds = notices.flatMap((n) => (n.companyId ? [n.companyId] : []))
  const [withJobs, orgs] = await Promise.all([
    companyIds.length
      ? prisma.companyJobOpening.groupBy({ by: ['companyId'], where: { companyId: { in: companyIds }, closedAt: null, states: { isEmpty: false } } })
      : Promise.resolve([]),
    prisma.crmOrganization.findMany({
      where: { canonicalNameNormalized: { in: notices.map((n) => n.normalizedEmployer) } },
      select: { canonicalNameNormalized: true },
    }),
  ])
  const hasJobs = new Set(withJobs.map((r) => r.companyId))
  const crm = new Set(orgs.map((o) => o.canonicalNameNormalized))
  for (const n of notices) {
    const inCrm = crm.has(n.normalizedEmployer)
    if (inCrm || (n.companyId && hasJobs.has(n.companyId))) out.set(n.id, { inCrm })
  }
  return out
}

/** "12% of staff" in a news layoff's label, the one place the share is kept. */
function percentFrom(label: string | null): number | null {
  const m = label?.match(/(\d{1,3}(?:\.\d+)?)% of staff/)
  return m ? parseFloat(m[1]) : null
}

/**
 * Who is worth @-mentioning on the post: up to three people we already know at
 * the employer (most recently touched first), and the local workforce board
 * that runs Rapid Response there. The employer's own page is always worth a
 * tag and is added in the admin. These are prompts: tags are typed by hand.
 */
async function tagSuggestionsFor(orgId: string | null, normalizedEmployer: string, boardId: string | null) {
  const out: DraftFacts['tagSuggestions'] = []
  try {
    const org = orgId
      ? { id: orgId }
      : await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: normalizedEmployer }, select: { id: true } })
    if (org) {
      const people = await prisma.crmPerson.findMany({
        where: { deletedAt: null, linkedinUrl: { not: null }, affiliations: { some: { orgId: org.id, isCurrent: true } } },
        orderBy: { lastTouchedAt: { sort: 'desc', nulls: 'last' } },
        take: 3,
        select: { fullName: true, linkedinUrl: true },
      })
      for (const p of people) out.push({ name: p.fullName, note: 'in our CRM at this employer', linkedinUrl: p.linkedinUrl })
    }
    if (boardId) {
      const board = await prisma.workforceBoard.findUnique({ where: { id: boardId }, select: { name: true, website: true } })
      if (board) out.push({ name: board.name, note: 'local workforce board (runs Rapid Response)', linkedinUrl: null })
    }
  } catch (e) {
    console.error('LinkedIn draft tag suggestions failed for', normalizedEmployer, e)
  }
  return out
}
