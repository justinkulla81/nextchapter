import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BOT_SIGNATURES } from '@/lib/http/user-agent'
import { loadCapturedEmailsForDays, groupByEmail, type CapturedPerson } from '@/lib/leads/captured-emails'
import { isRealOpen } from '@/lib/leads/lead-status'
import { registrationStop, STOPS, type Stop } from '@/lib/admin/registration-stop'

// The lead and registration path report (/support/admin/lead-paths). Read only.
//
// Two lists, because they are two different ways in:
//  - Starters: everyone who began the registration path (a profile exists the moment someone answers the first
//    question), with the page they stopped on, how they arrived and whether they finished.
//  - Email givers: everyone who left an address on any form, with the nudges we sent, whether they opened or clicked,
//    whether they registered, and the last page they viewed.
// Visitors carry no account until they register, so pages viewed are joined by IP, the same identity the Funnel
// and Visitors reports use. An IP can be shared, so "last page" is a good guide, not proof.

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_STARTERS = 2000
const botPatterns = BOT_SIGNATURES.map((s) => `%${s}%`)

export interface Nudges {
  personId: string | null
  /** Steps sent, in order: welcome, nudge1, nudge2, next_step, data_point, assessment. */
  steps: string[]
  opened: boolean
  clicked: boolean
  registered: boolean
}

export interface Starter {
  id: string
  startedAt: Date
  name: string | null
  email: string | null
  journey: string | null
  /** First page their network viewed, and where they came from. */
  entryPath: string | null
  entryFrom: string | null
  stop: Stop
  registered: boolean
  nudges: Nudges | null
}

export interface StopRow {
  stop: Stop
  /** People whose path ends on this step right now. */
  stoppedHere: number
  /** People who reached this step (it, or any later one). */
  reached: number
}

export interface EmailGiver extends CapturedPerson {
  nudges: Nudges
  registered: boolean
  lastPath: string | null
}

export interface FallOffPage {
  path: string
  people: number
}

export interface SourceRow {
  source: string
  captured: number
  nudged: number
  clicked: number
  registered: number
}

export interface LeadPathsData {
  days: number
  starters: Starter[]
  stops: StopRow[]
  startersTruncated: boolean
  givers: EmailGiver[]
  fallOff: FallOffPage[]
  bySource: SourceRow[]
}

const EMPTY: Nudges = { personId: null, steps: [], opened: false, clicked: false, registered: false }

function searchEngineLabel(referrer: string | null): string {
  if (!referrer) return 'Direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    if (host.endsWith('launchyournextchapter.com')) return 'Direct'
    return /google|bing|duckduckgo|yahoo|ecosia|baidu/i.test(host) ? 'Search' : host
  } catch {
    return 'Direct'
  }
}

/** The page without its query string, so /jobs?q=a and /jobs?q=b are one place. */
export function pageOf(path: string | null): string | null {
  if (!path) return null
  return path.split('?')[0].split('#')[0] || '/'
}

async function loadNudges(emails: string[]): Promise<Map<string, Nudges>> {
  const out = new Map<string, Nudges>()
  if (emails.length === 0) return out
  const persons = await prisma.crmPerson.findMany({
    where: { deletedAt: null, email: { in: emails } },
    select: { id: true, email: true, candidateId: true },
  })
  const emailOf = new Map<string, string>()
  for (const p of persons) {
    emailOf.set(p.id, p.email!)
    out.set(p.email!, { ...EMPTY, steps: [], personId: p.id, registered: !!p.candidateId })
  }
  if (persons.length === 0) return out
  const sent = await prisma.crmActivity.findMany({
    where: {
      type: 'EMAIL',
      personId: { in: persons.map((p) => p.id) },
      OR: [{ sourceRef: { startsWith: 'lifecycle:' } }, { sourceRef: { startsWith: 'nurture:' } }],
    },
    orderBy: { occurredAt: 'asc' },
    select: { personId: true, sourceRef: true, occurredAt: true, outreachTracking: { select: { openCount: true, openedAt: true, links: { select: { clickCount: true } } } } },
  })
  for (const a of sent) {
    const n = out.get(emailOf.get(a.personId!)!)
    if (!n) continue
    n.steps.push((a.sourceRef ?? '').split(':')[1] ?? 'email')
    if (isRealOpen(a.occurredAt, a.outreachTracking?.openedAt ?? null, a.outreachTracking?.openCount ?? 0)) n.opened = true
    if (a.outreachTracking?.links.some((l) => l.clickCount > 0)) n.clicked = true
  }
  return out
}

/** First (entry) or last page each network viewed, human traffic only. */
async function pagesByIp(ips: string[], which: 'first' | 'last'): Promise<Map<string, { path: string | null; referrer: string | null }>> {
  const out = new Map<string, { path: string | null; referrer: string | null }>()
  const unique = [...new Set(ips.filter(Boolean))]
  if (unique.length === 0) return out
  const order = which === 'first' ? Prisma.sql`ASC` : Prisma.sql`DESC`
  const rows = await prisma.$queryRaw<{ ip: string; path: string | null; referrer: string | null }[]>(Prisma.sql`
    SELECT DISTINCT ON ("ip") "ip", "path", "referrer" FROM "HomepageVisitEvent"
    WHERE "eventType" = 'PAGE_VIEW' AND "ip" = ANY(${unique}) AND "path" IS NOT NULL
      AND "userAgent" IS NOT NULL AND NOT ("userAgent" ILIKE ANY(${botPatterns}))
    ORDER BY "ip", "createdAt" ${order}`)
  for (const r of rows) out.set(r.ip, { path: r.path, referrer: r.referrer })
  return out
}

async function loadStarters(since: Date): Promise<{ starters: Starter[]; truncated: boolean }> {
  const profiles = await prisma.candidateProfile.findMany({
    where: { createdAt: { gte: since }, isSystemAccount: false, NOT: { userId: { startsWith: 'demo-' } } },
    orderBy: { createdAt: 'desc' },
    take: MAX_STARTERS + 1,
    select: {
      id: true,
      createdAt: true,
      firstName: true,
      lastName: true,
      email: true,
      signupIp: true,
      journey: true,
      journeyDetails: true,
      desireComplete: true,
      resumeStepComplete: true,
      onboardingResumeConfirmedAt: true,
      onboardingLocationConfirmedAt: true,
      onboardingComfortConfirmedAt: true,
      contractAcceptedAt: true,
      registrationCompletedAt: true,
      introCommittedAt: true,
      duplicateEmailBlockedAt: true,
    },
  })
  const truncated = profiles.length > MAX_STARTERS
  const rows = profiles.slice(0, MAX_STARTERS)
  const emails = [...new Set(rows.map((p) => p.email?.trim().toLowerCase()).filter((e): e is string => !!e))]
  const [nudges, entries] = await Promise.all([loadNudges(emails), pagesByIp(rows.map((p) => p.signupIp ?? ''), 'first')])

  const starters = rows.map<Starter>((p) => {
    const email = p.email?.trim().toLowerCase() || null
    const entry = p.signupIp ? entries.get(p.signupIp) : undefined
    return {
      id: p.id,
      startedAt: p.createdAt,
      name: [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || null,
      email,
      journey: p.journey ?? null,
      entryPath: entry?.path ?? null,
      entryFrom: entry ? searchEngineLabel(entry.referrer) : null,
      stop: registrationStop(p),
      registered: !!p.registrationCompletedAt,
      nudges: email ? (nudges.get(email) ?? null) : null,
    }
  })
  return { starters, truncated }
}

function stopRows(starters: Starter[]): StopRow[] {
  const here = new Map<number, number>()
  for (const s of starters) here.set(s.stop.rank, (here.get(s.stop.rank) ?? 0) + 1)
  return STOPS.map((stop) => ({
    stop,
    stoppedHere: here.get(stop.rank) ?? 0,
    reached: starters.filter((s) => s.stop.rank >= stop.rank).length,
  }))
}

async function loadGivers(days: number): Promise<{ givers: EmailGiver[]; fallOff: FallOffPage[]; bySource: SourceRow[] }> {
  const people = groupByEmail(await loadCapturedEmailsForDays(days))
  const emails = people.map((p) => p.email)
  const [nudges, last, profiles] = await Promise.all([
    loadNudges(emails),
    pagesByIp(people.map((p) => p.ip ?? ''), 'last'),
    emails.length
      ? prisma.candidateProfile.findMany({ where: { email: { in: emails }, registrationCompletedAt: { not: null } }, select: { email: true } })
      : Promise.resolve([]),
  ])
  const registeredEmails = new Set(profiles.map((p) => p.email?.trim().toLowerCase()))

  const givers = people.map<EmailGiver>((p) => {
    const n = nudges.get(p.email) ?? { ...EMPTY, steps: [] }
    const registered = n.registered || registeredEmails.has(p.email)
    return { ...p, nudges: { ...n, registered }, registered, lastPath: pageOf(p.ip ? (last.get(p.ip)?.path ?? null) : null) }
  })

  // Where the people who did not register were last seen.
  const pages = new Map<string, number>()
  for (const g of givers) if (!g.registered && g.lastPath) pages.set(g.lastPath, (pages.get(g.lastPath) ?? 0) + 1)
  const fallOff = [...pages.entries()].map(([path, n]) => ({ path, people: n })).sort((a, b) => b.people - a.people).slice(0, 15)

  const by = new Map<string, SourceRow>()
  for (const g of givers) {
    const source = g.firstWhere.split(' · ')[0] || 'Other'
    const row = by.get(source) ?? { source, captured: 0, nudged: 0, clicked: 0, registered: 0 }
    row.captured++
    if (g.nudges.steps.length > 0) row.nudged++
    if (g.nudges.clicked) row.clicked++
    if (g.registered) row.registered++
    by.set(source, row)
  }
  return { givers, fallOff, bySource: [...by.values()].sort((a, b) => b.captured - a.captured) }
}

export async function computeLeadPaths(days: number): Promise<LeadPathsData> {
  const since = new Date(Date.now() - days * DAY_MS)
  const [{ starters, truncated }, giverData] = await Promise.all([loadStarters(since), loadGivers(days)])
  return { days, starters, stops: stopRows(starters), startersTruncated: truncated, ...giverData }
}
