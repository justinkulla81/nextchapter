// Founders for a college's entrepreneurship center (CMU: Swartz Center), and the same list for every office in the portal.
//
// Who is flagged:
// - CONSIDERING: the member answered a check-in "I'm starting a company" (they told the college), or their NextChapter journey is
//   building or buying a business and they switched on SHARE_VENTURE. That journey is confidential by default, so it never
//   reaches the college without one of the two.
// - STARTED: the venture has launched (start stage launch or grow, or a bought business they now own or run) and they share it
//   (SHARE_VENTURE, or SHARE_OUTCOME, which is on by default and already shares a new employer), or a shared new job is as a
//   founder or owner.
// What is shared: with SHARE_VENTURE, the venture's name, stage, kind, customers, team and funding. With outcome sharing only,
// the company name. Runway, hours and money are never shared.
//
// Data: syncVentureFlags reads, per institution, only members whose candidate is on a business journey or has business details
// (a few rows at most) plus founder titles in shared new jobs from the last 400 days; one nightly run per institution. The staff
// list reads at most 200 flags.

import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { visibleMemberSqlFor } from '@/lib/plans/visible-members'
import { START_FIELDS, START_STAGES, startDetailsOf, type StartDetails } from '@/lib/journey/start-business'
import { buyDetailsOf } from '@/lib/journey/buy-business'

export type VentureStatus = 'CONSIDERING' | 'STARTED'
export type VentureSource = 'CHECK_IN' | 'SHARED' | 'OUTCOME'

const FOUNDER_TITLE = /\b(founder|co-?founder|cofounder|owner|founding partner|proprietor)\b/i
const NOT_FOUNDER = /\b(product|process|account|risk|control|data|business process) owner\b/i
export const isFounderTitle = (title: string) => FOUNDER_TITLE.test(title) && !NOT_FOUNDER.test(title)

export type VentureSnapshot = { status: VentureStatus; name: string | null; stage: string | null; details: StartDetails; buying: boolean }

/** What a NextChapter profile says about a venture, before any sharing rule. Null = not building or buying a business. */
export function ventureFromProfile(journey: string | null, journeyDetails: unknown): VentureSnapshot | null {
  const d = (journeyDetails ?? {}) as Record<string, unknown>
  const name = typeof d.venture === 'string' && d.venture.trim() ? d.venture.trim().slice(0, 120) : null
  const start = startDetailsOf(journeyDetails)
  const buy = buyDetailsOf(journeyDetails)
  const building = journey === 'ENTREPRENEUR' || !!start.stage
  const buying = journey === 'BUY_BUSINESS' || !!buy.stage
  if (!building && !buying) return null
  if (building) {
    const started = start.stage === 'launch' || start.stage === 'grow'
    return { status: started ? 'STARTED' : 'CONSIDERING', name, stage: start.stage ?? null, details: start, buying: false }
  }
  const owns = buy.stage === 'own' || buy.stage === 'run'
  return { status: owns ? 'STARTED' : 'CONSIDERING', name, stage: buy.stage ? `buying:${buy.stage}` : 'buying', details: {}, buying: true }
}

const STAGE_LABEL = Object.fromEntries(START_STAGES.map((s) => [s.key, s.label])) as Record<string, string>
const BUY_LABEL: Record<string, string> = { decide: 'Deciding to buy', prepare: 'Preparing to buy', search: 'Searching for a business', evaluate: 'Evaluating a business', close: 'Closing a purchase', own: 'New owner', run: 'Running a bought business' }
export function stageLabel(stage: string | null): string | null {
  if (!stage) return null
  if (stage === 'buying') return 'Buying a business'
  if (stage.startsWith('buying:')) return BUY_LABEL[stage.slice(7)] ?? 'Buying a business'
  return STAGE_LABEL[stage] ?? null
}
const optionLabel = (key: string, value: string | undefined) => START_FIELDS.find((f) => f.key === key)?.options.find((o) => o.value === value)?.label ?? null
/** The shared details in words: kind, customers, team, funding. */
export function detailLines(d: StartDetails): string[] {
  const out = [optionLabel('kind', d.kind), optionLabel('customers', d.customers), optionLabel('team', d.team)].filter((x): x is string => !!x)
  if (d.funding?.length) out.push(d.funding.map((f) => optionLabel('funding', f)).filter(Boolean).join(', '))
  return out
}

export const FUNDING_ROUNDS = [
  ['bootstrapped', 'Self-funded'],
  ['grant', 'Grants or competitions'],
  ['pre_seed', 'Pre-seed'],
  ['seed', 'Seed'],
  ['series_a', 'Series A'],
  ['series_b_plus', 'Series B or later'],
] as const
export const FUNDING_TOTALS = [
  ['under_250k', 'Under $250K'],
  ['250k_1m', '$250K to $1M'],
  ['1m_5m', '$1M to $5M'],
  ['5m_20m', '$5M to $20M'],
  ['over_20m', 'Over $20M'],
] as const
export const EXIT_KINDS = [
  ['acquired', 'Acquired'],
  ['ipo', 'Went public'],
  ['closed', 'Closed'],
] as const
const label = (list: readonly (readonly [string, string])[], v: string | null | undefined) => list.find(([k]) => k === v)?.[1] ?? null

/** Funding and exit in words, for the Founders list. */
export function fundingLine(f: { fundingRound: string | null; fundingTotal: string | null; exitKind: string | null; exitAcquirer: string | null; exitYear: number | null }): string[] {
  const out: string[] = []
  const round = label(FUNDING_ROUNDS, f.fundingRound)
  const total = label(FUNDING_TOTALS, f.fundingTotal)
  if (round || total) out.push([round, total ? `${total} raised` : null].filter(Boolean).join(' · '))
  const exit = label(EXIT_KINDS, f.exitKind)
  if (exit) out.push([f.exitKind === 'acquired' && f.exitAcquirer ? `Acquired by ${f.exitAcquirer}` : exit, f.exitYear ? String(f.exitYear) : null].filter(Boolean).join(', '))
  return out
}

export type VentureReport = { ventureName: string; website: string | null; fundingRound: string | null; fundingTotal: string | null; exitKind: string | null; exitAcquirer: string | null; exitYear: number | null }

/** Clean what the alum typed. Returns an error in plain words, or the report. */
export function parseVentureReport(f: FormData, year = new Date().getUTCFullYear()): { error: string } | VentureReport {
  const s = (k: string, max: number) => String(f.get(k) ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  const ventureName = s('ventureName', 120)
  if (!ventureName) return { error: 'Add the name of your company.' }
  let website: string | null = s('website', 200) || null
  if (website) {
    try {
      const u = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`)
      website = u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
    } catch {
      return { error: 'That website address doesn’t look right. Try something like example.com.' }
    }
  }
  const pick = (k: string, list: readonly (readonly [string, string])[]) => {
    const v = s(k, 40)
    return list.some(([x]) => x === v) ? v : null
  }
  const exitKind = pick('exitKind', EXIT_KINDS)
  const y = Number(s('exitYear', 4))
  const exitYear = exitKind && Number.isInteger(y) && y >= 1950 && y <= year ? y : null
  return { ventureName, website, fundingRound: pick('fundingRound', FUNDING_ROUNDS), fundingTotal: pick('fundingTotal', FUNDING_TOTALS), exitKind, exitAcquirer: exitKind === 'acquired' ? s('exitAcquirer', 120) || null : null, exitYear }
}

/** The alum reports their venture: it is shared with the center (SHARE_VENTURE is switched on by the caller) and marked started. */
export async function saveVentureReport(institutionId: string, memberId: string, r: VentureReport, now = new Date()) {
  const existing = await prisma.ventureFlag.findUnique({ where: { institutionId_memberId: { institutionId, memberId } }, select: { id: true, status: true } })
  const data = { ...r, reportedAt: now }
  if (existing) {
    await prisma.ventureFlag.update({ where: { id: existing.id }, data: { ...data, status: 'STARTED', ...(existing.status !== 'STARTED' ? { startedAt: now } : {}) } })
  } else {
    await prisma.ventureFlag.create({ data: { institutionId, memberId, status: 'STARTED', source: 'SHARED', firstFlaggedAt: now, startedAt: now, ...data } })
  }
  captureServerEvent(`member:${memberId}`, 'he_venture_updated', { institutionId, memberId, fundingRound: r.fundingRound, fundingTotal: r.fundingTotal, exitKind: r.exitKind, created: !existing })
}

/** The member said "I'm starting a company" in a check-in: flag them now (they told the college). */
export async function flagFromCheckIn(memberId: string, institutionId: string, now = new Date()) {
  const existing = await prisma.ventureFlag.findUnique({ where: { institutionId_memberId: { institutionId, memberId } }, select: { id: true } })
  if (existing) return
  await prisma.ventureFlag.create({ data: { institutionId, memberId, status: 'CONSIDERING', source: 'CHECK_IN', firstFlaggedAt: now } })
  captureServerEvent(`member:${memberId}`, 'he_venture_flagged', { institutionId, memberId, status: 'CONSIDERING', source: 'CHECK_IN' })
}

const NO_DETAILS = { ventureName: null, ventureStage: null, website: null, fundingRound: null, fundingTotal: null, exitKind: null, exitAcquirer: null, exitYear: null, reportedAt: null }

type Want = { status: VentureStatus; source: VentureSource; ventureName: string | null; ventureStage: string | null }

/** Rebuild one institution's flags from what members share. Check-in flags stay; shared ones follow consent both ways. */
export async function syncVentureFlags(institutionId: string, now = new Date()): Promise<{ created: number; started: number; removed: number }> {
  const since = new Date(now.getTime() - 400 * 86_400_000)
  const [members, founderJobs, existing] = await Promise.all([
    // Members on a business journey, or with business details alongside another journey, and their latest two sharing choices.
    prisma.$queryRaw<{ id: string; journey: string | null; journeyDetails: unknown; shareVenture: boolean | null; shareOutcome: boolean | null }[]>`
      select m.id, c.journey::text as journey, c."journeyDetails",
        (select ic.granted from public."InstitutionConsent" ic where ic."memberId" = m.id and ic.scope = 'SHARE_VENTURE' order by ic."changedAt" desc limit 1) as "shareVenture",
        (select ic.granted from public."InstitutionConsent" ic where ic."memberId" = m.id and ic.scope = 'SHARE_OUTCOME' order by ic."changedAt" desc limit 1) as "shareOutcome"
      from public."InstitutionMember" m join public."CandidateProfile" c on c.id = m."candidateId"
      where m."institutionId" = ${institutionId} and m.status in ('CLAIMED', 'ACTIVE')
        and (c.journey in ('ENTREPRENEUR', 'BUY_BUSINESS') or c."journeyDetails" ? 'start' or c."journeyDetails" ? 'buy')
      limit 2000`,
    // Shared new jobs as a founder or owner (outcome sharing, on by default).
    prisma.$queryRaw<{ memberId: string; title: string; company: string; reportedAt: Date }[]>`
      select distinct on (o."memberId") o."memberId", e.title, c.name as company, o."reportedAt"
      from public."OutcomeReport" o
      join public."InstitutionMember" m on m.id = o."memberId" and m."institutionId" = ${institutionId}
      join public."MemberEmployment" e on e.id = o."memberEmploymentId"
      join public."Company" c on c.id = e."companyId"
      where o."reportedAt" >= ${since}
        and e.title ~* '(founder|co-?founder|cofounder|owner|founding partner|proprietor)'
        and coalesce((select ic.granted from public."InstitutionConsent" ic where ic."memberId" = m.id and ic.scope = 'SHARE_OUTCOME' order by ic."changedAt" desc limit 1), true)
      order by o."memberId", o."reportedAt" desc
      limit 500`,
    prisma.ventureFlag.findMany({ where: { institutionId }, select: { id: true, memberId: true, status: true, source: true, ventureName: true, ventureStage: true, reportedAt: true } }),
  ])

  const want = new Map<string, Want>()
  for (const m of members) {
    const snap = ventureFromProfile(m.journey, m.journeyDetails)
    if (!snap) continue
    const shareVenture = m.shareVenture === true
    const shareOutcome = m.shareOutcome !== false
    if (shareVenture) want.set(m.id, { status: snap.status, source: 'SHARED', ventureName: snap.name, ventureStage: snap.stage })
    else if (snap.status === 'STARTED' && shareOutcome) want.set(m.id, { status: 'STARTED', source: 'OUTCOME', ventureName: snap.name, ventureStage: null })
  }
  for (const j of founderJobs) {
    if (!isFounderTitle(j.title)) continue
    const had = want.get(j.memberId)
    want.set(j.memberId, { status: 'STARTED', source: had?.source ?? 'OUTCOME', ventureName: had?.ventureName ?? j.company, ventureStage: had?.ventureStage ?? null })
  }

  // Ventures the alum reported on their portal stay while they share them (SHARE_VENTURE), journey or not.
  const reportedIds = existing.filter((e) => e.reportedAt).map((e) => e.memberId)
  const reportedShared = new Set<string>()
  if (reportedIds.length) {
    const consents = await prisma.institutionConsent.findMany({ where: { memberId: { in: reportedIds }, scope: 'SHARE_VENTURE' }, orderBy: { changedAt: 'desc' }, select: { memberId: true, granted: true } })
    const latest = new Map<string, boolean>()
    for (const c of consents) if (!latest.has(c.memberId)) latest.set(c.memberId, c.granted)
    for (const id of reportedIds) if (latest.get(id) === true) reportedShared.add(id)
  }

  let created = 0
  let started = 0
  let removed = 0
  const byMember = new Map(existing.map((e) => [e.memberId, e]))
  for (const [memberId, w] of want) {
    const e = byMember.get(memberId)
    if (!e) {
      await prisma.ventureFlag.create({ data: { institutionId, memberId, ...w, firstFlaggedAt: now, startedAt: w.status === 'STARTED' ? now : null } })
      captureServerEvent(`member:${memberId}`, 'he_venture_flagged', { institutionId, memberId, status: w.status, source: w.source })
      created++
      continue
    }
    // Never step a started venture back; a check-in flag keeps its source.
    const status: VentureStatus = e.status === 'STARTED' || w.status === 'STARTED' ? 'STARTED' : 'CONSIDERING'
    const source = e.source === 'CHECK_IN' && w.source === 'SHARED' ? 'CHECK_IN' : w.source
    // A name the alum typed on their portal wins over an empty one from the profile.
    const ventureName = w.ventureName ?? (reportedShared.has(memberId) ? e.ventureName : null)
    if (status !== e.status || source !== e.source || ventureName !== e.ventureName || w.ventureStage !== e.ventureStage) {
      await prisma.ventureFlag.update({ where: { id: e.id }, data: { status, source, ventureName, ventureStage: w.ventureStage, ...(status === 'STARTED' && e.status !== 'STARTED' ? { startedAt: now } : {}) } })
      if (status === 'STARTED' && e.status !== 'STARTED') {
        captureServerEvent(`member:${memberId}`, 'he_venture_flagged', { institutionId, memberId, status, source })
        started++
      }
    }
  }
  // Shared flags whose sharing was switched off go; a check-in flag stays, but loses any shared details.
  for (const e of existing) {
    if (want.has(e.memberId) || reportedShared.has(e.memberId)) continue
    if (e.source === 'CHECK_IN') {
      if (e.ventureName || e.ventureStage || e.reportedAt) await prisma.ventureFlag.update({ where: { id: e.id }, data: { ...NO_DETAILS } })
      continue
    }
    await prisma.ventureFlag.delete({ where: { id: e.id } })
    removed++
  }
  return { created, started, removed }
}

export type VentureRow = {
  id: string
  memberId: string
  firstName: string | null
  lastName: string | null
  classYear: number | null
  email: string
  status: VentureStatus
  source: VentureSource
  ventureName: string | null
  stage: string | null
  details: string[]
  firstFlaggedAt: Date
  startedAt: Date | null
  contactedAt: Date | null
  website: string | null
  funding: string[]
}

/** Staff list, newest first: started ventures, then people thinking about one. Details only for members who share the venture. */
export async function ventureFlags(institutionId: string, limit = 200): Promise<VentureRow[]> {
  const rows = await prisma.$queryRaw<
    { id: string; memberId: string; firstName: string | null; lastName: string | null; classYear: number | null; email: string; status: string; source: string; ventureName: string | null; ventureStage: string | null; firstFlaggedAt: Date; startedAt: Date | null; contactedAt: Date | null; candidateId: string | null; website: string | null; fundingRound: string | null; fundingTotal: string | null; exitKind: string | null; exitAcquirer: string | null; exitYear: number | null }[]
  >`
    select f.id, f."memberId", m."firstName", m."lastName", m."classYear", m.email, f.status, f.source, f."ventureName", f."ventureStage",
      f."firstFlaggedAt", f."startedAt", f."contactedAt", m."candidateId", f.website, f."fundingRound", f."fundingTotal", f."exitKind", f."exitAcquirer", f."exitYear"
    from public."VentureFlag" f join public."InstitutionMember" m on m.id = f."memberId"
    where f."institutionId" = ${institutionId} ${await visibleMemberSqlFor(institutionId, Prisma.sql`m.id`)}
    order by (f.status = 'STARTED') desc, coalesce(f."startedAt", f."firstFlaggedAt") desc
    limit ${limit}`
  // Kind, customers, team and funding come straight from the profile, and only for members who share the venture.
  const sharedIds = rows.filter((r) => r.source === 'SHARED' && r.candidateId).map((r) => r.candidateId as string)
  const profiles = sharedIds.length ? await prisma.candidateProfile.findMany({ where: { id: { in: sharedIds } }, select: { id: true, journeyDetails: true } }) : []
  const detailsBy = new Map(profiles.map((p) => [p.id, detailLines(startDetailsOf(p.journeyDetails))]))
  return rows.map((r) => ({
    id: r.id,
    memberId: r.memberId,
    firstName: r.firstName,
    lastName: r.lastName,
    classYear: r.classYear,
    email: r.email,
    status: r.status as VentureStatus,
    source: r.source as VentureSource,
    ventureName: r.ventureName,
    stage: stageLabel(r.ventureStage),
    details: r.source === 'SHARED' && r.candidateId ? (detailsBy.get(r.candidateId) ?? []) : [],
    firstFlaggedAt: r.firstFlaggedAt,
    startedAt: r.startedAt,
    contactedAt: r.contactedAt,
    website: r.website,
    funding: fundingLine(r),
  }))
}

/** One member's flag, for the member record every office sees. */
export async function ventureForMember(memberId: string) {
  const f = await prisma.ventureFlag.findFirst({ where: { memberId }, select: { status: true, source: true, ventureName: true, ventureStage: true, contactedAt: true, website: true, fundingRound: true, fundingTotal: true, exitKind: true, exitAcquirer: true, exitYear: true, reportedAt: true } })
  return f ? { ...f, stage: stageLabel(f.ventureStage) } : null
}
