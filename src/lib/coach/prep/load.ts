import 'server-only'
import type { CandidateProfile, Coach } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMondayOfWeek } from '@/lib/weekly/sprint'
import { sumEffortMinutes } from '@/lib/scoring/effort-minutes'
import { effortKind } from '@/lib/scoring/effort-actions'
import { buildEvidenceTraits } from '@/lib/dossier/evidence-traits'
import { loadTraitSignals } from '@/lib/dossier/evidence-signals'
import { resolveCandidateOccupation } from '@/lib/careers/candidate-occupation'
import { getAreaCatalog, getPayLookup } from '@/lib/careers/local-pay-server'
import { resolveArea } from '@/lib/careers/area'
import { bestPay } from '@/lib/careers/local-pay'
import { loadCandidateExposure } from '@/lib/skills/ai-exposure-server'
import { AI_EXPOSURE_SOURCE, EXPOSURE_WHY, exposureSentence } from '@/lib/skills/ai-exposure'
import { cycleLineForSoc } from '@/lib/pivots/occupation-cycle'
import { buildPrep, primaryAction } from '@/lib/coach/prep/build'
import type { AgreedItem, EffortFacts, MarketFacts, PipelineFacts, PrepInput, PrepSessionFacts, PrepView, TraitFact } from '@/lib/coach/prep/types'

// Reads the facts for one member's session prep and hands them to the pure builder (build.ts). Every read is
// its own fail-soft step: one that throws becomes null for that section, and the rest of the page still renders.
// Nothing is read about the search unless the member consented (coachDossierConsentedAt), and the member's money
// situation is never read at all. Company names are not even fetched in Confidential Search Mode.

const DAY_MS = 24 * 60 * 60 * 1000

async function soft<T>(label: string, work: () => Promise<T>): Promise<T | null> {
  try {
    return await work()
  } catch (error) {
    console.error(`Session prep: ${label} unavailable:`, error)
    return null
  }
}

// ── Session and history ─────────────────────────────────────────────────────

async function loadSession(coachId: string, candidateId: string, now: Date): Promise<PrepSessionFacts | null> {
  const [booking, settings, held] = await Promise.all([
    prisma.coachBooking.findFirst({
      where: { coachId, candidateId, status: 'CONFIRMED', endsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
      select: { startsAt: true, endsAt: true, meetUrl: true },
    }),
    prisma.coachBookingSettings.findUnique({ where: { coachId }, select: { timezone: true } }),
    prisma.coachSession.count({ where: { coachId, candidateId } }),
  ])
  if (!booking) return null
  return {
    startsAt: booking.startsAt,
    minutes: Math.max(1, Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000)),
    meetUrl: booking.meetUrl,
    ordinal: held + 1,
    timezone: settings?.timezone ?? 'America/New_York',
  }
}

// ── This week ───────────────────────────────────────────────────────────────

type StoredAction = { actionType?: string; completed?: boolean; completedAt?: string; points?: number }

function activeDays(sprints: { committedActions: unknown }[]): number {
  const days = new Set<string>()
  for (const sprint of sprints) {
    const actions = Array.isArray(sprint.committedActions) ? (sprint.committedActions as StoredAction[]) : []
    for (const a of actions) {
      if (!a.completed || !a.completedAt || effortKind(a) === 'none') continue
      const d = new Date(a.completedAt)
      if (!Number.isNaN(d.getTime())) days.add(d.toISOString().slice(0, 10))
    }
  }
  return days.size
}

const OUTBOUND_OUTREACH = ['THANK_YOU', 'FOLLOW_UP', 'CHECK_IN', 'INTRO_REQUEST', 'NETWORKING_OUTREACH'] as const

async function loadEffort(candidateId: string, now: Date): Promise<EffortFacts> {
  const thisMonday = getMondayOfWeek(now)
  const lastMonday = new Date(thisMonday.getTime() - 7 * DAY_MS)
  const [sprints, lastLog, lastEmail] = await Promise.all([
    prisma.weeklySprint.findMany({ where: { candidateId, weekStartDate: { in: [thisMonday, lastMonday] } }, select: { weekStartDate: true, committedActions: true } }),
    prisma.outreachLog.findFirst({ where: { candidateId }, orderBy: { loggedAt: 'desc' }, select: { loggedAt: true } }),
    prisma.trackedEmailActivity.findFirst({
      where: { candidateId, direction: 'OUTBOUND', dismissedAt: null, activityType: { in: [...OUTBOUND_OUTREACH] } },
      orderBy: { detectedAt: 'desc' },
      select: { detectedAt: true },
    }),
  ])
  const thisWeek = sprints.filter((s) => s.weekStartDate.getTime() === thisMonday.getTime())
  const lastWeek = sprints.filter((s) => s.weekStartDate.getTime() === lastMonday.getTime())
  const lastOutreach = [lastLog?.loggedAt, lastEmail?.detectedAt].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0]
  return {
    thisWeekMinutes: sumEffortMinutes(thisWeek),
    lastWeekMinutes: sumEffortMinutes(lastWeek),
    activeDaysThis: activeDays(thisWeek),
    activeDaysLast: activeDays(lastWeek),
    daysSinceOutreach: lastOutreach ? Math.floor((now.getTime() - lastOutreach.getTime()) / DAY_MS) : null,
  }
}

async function loadPipeline(candidateId: string, confidential: boolean, since: Date, now: Date): Promise<PipelineFacts> {
  const [applied, answered, calendarInterviews, upcoming, newInterviews, inviteEmails, offers, latestInvite] = await Promise.all([
    prisma.trackedJob.findMany({
      where: { candidateId, dismissedAt: null, OR: [{ appliedVia: { not: null } }, { promptAnswer: 'applied' }] },
      orderBy: { updatedAt: 'desc' },
      select: { title: true },
      take: 200,
    }),
    prisma.trackedEmailActivity.findMany({
      where: { candidateId, dismissedAt: null, direction: 'INBOUND', activityType: { in: ['INTERVIEW_INVITE', 'REJECTION', 'OFFER'] } },
      select: { threadId: true, companyName: true, id: true },
    }),
    // Titles on calendar events are the member's own; only the time is read here.
    prisma.trackedCalendarEvent.count({ where: { candidateId, eventType: 'INTERVIEW', dismissedAt: null } }),
    prisma.trackedCalendarEvent.findFirst({ where: { candidateId, eventType: 'INTERVIEW', dismissedAt: null, startTime: { gte: now } }, orderBy: { startTime: 'asc' }, select: { startTime: true } }),
    prisma.trackedCalendarEvent.count({ where: { candidateId, eventType: 'INTERVIEW', dismissedAt: null, detectedAt: { gte: since } } }),
    prisma.trackedEmailActivity.count({ where: { candidateId, dismissedAt: null, direction: 'INBOUND', activityType: 'INTERVIEW_INVITE' } }),
    prisma.trackedEmailActivity.count({ where: { candidateId, dismissedAt: null, direction: 'INBOUND', activityType: 'OFFER' } }),
    prisma.trackedEmailActivity.findFirst({
      where: { candidateId, dismissedAt: null, direction: 'INBOUND', activityType: 'INTERVIEW_INVITE' },
      orderBy: { detectedAt: 'desc' },
      // The company is only selected when the member has not hidden company names.
      select: { roleTitle: true, ...(confidential ? {} : { companyName: true }) },
    }),
  ])
  // One reply per conversation: group by thread, else company, else the row.
  const replied = new Set(answered.map((a) => a.threadId ?? (confidential ? a.id : a.companyName) ?? a.id)).size
  const invite = latestInvite as { roleTitle: string | null; companyName?: string | null } | null
  return {
    applied: applied.length,
    replied,
    interviews: Math.max(calendarInterviews, inviteEmails),
    offers,
    roles: [...new Set(applied.map((a) => a.title.trim()).filter(Boolean))].slice(0, 3),
    nextInterview: upcoming ? { at: upcoming.startTime, role: invite?.roleTitle ?? null, company: confidential ? null : (invite?.companyName ?? null) } : null,
    newInterviews,
  }
}

async function loadGrade(candidateId: string): Promise<{ from: string; to: string } | null> {
  const snaps = await prisma.marketRealitySnapshot.findMany({ where: { candidateId }, orderBy: { weekStartDate: 'desc' }, take: 2, select: { grade: true } })
  return snaps.length === 2 && snaps[0].grade && snaps[1].grade ? { from: String(snaps[1].grade), to: String(snaps[0].grade) } : null
}

// ── What was agreed ─────────────────────────────────────────────────────────

/**
 * Follow-ups come from the notes branch's table when it exists (one row per follow-up with an owner and a due date).
 * Until then, and for sessions logged before it, the earlier sessions' action items and focus note are read instead.
 * The table is read through a loose type on purpose: this must keep working when the model is absent from the client.
 */
type FollowUpRow = { owner?: string; text?: string; title?: string; dueAt?: Date | null; dueDate?: Date | null; doneAt?: Date | null; completedAt?: Date | null; status?: string }

async function readFollowUps(coachId: string, candidateId: string): Promise<AgreedItem[]> {
  const model = (prisma as unknown as { coachFollowUp?: { findMany: (args: unknown) => Promise<FollowUpRow[]> } }).coachFollowUp
  if (!model) return []
  try {
    const rows = await model.findMany({ where: { candidateId, coachId }, orderBy: { createdAt: 'desc' }, take: 20 })
    return rows
      .map((r): AgreedItem | null => {
        const text = (r.text ?? r.title ?? '').trim()
        if (!text) return null
        const done = !!(r.doneAt ?? r.completedAt) || /^(done|complete|completed)$/i.test(r.status ?? '')
        return { owner: /coach/i.test(r.owner ?? '') ? 'coach' : 'member', text, status: done ? 'done' : 'open', dueAt: r.dueAt ?? r.dueDate ?? null, source: 'follow_up' }
      })
      .filter((r): r is AgreedItem => r !== null)
  } catch (error) {
    console.error('Session prep: follow-ups table could not be read, using earlier notes:', error)
    return []
  }
}

const splitItems = (text: string) =>
  text
    .split(/\n+/)
    .map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim())
    .filter((l) => l.length > 2)

async function loadAgreed(coachId: string, candidateId: string): Promise<AgreedItem[]> {
  const followUps = await readFollowUps(coachId, candidateId)
  if (followUps.length > 0) return followUps
  const last = await prisma.coachSession.findFirst({
    where: { coachId, candidateId },
    orderBy: { occurredAt: 'desc' },
    select: { directives: true, directivesResolvedAt: true, focusNote: true },
  })
  if (!last) return []
  const items: AgreedItem[] = splitItems(last.directives ?? '')
    .slice(0, 5)
    .map((text) => ({ owner: 'member' as const, text, status: last.directivesResolvedAt ? ('done' as const) : ('open' as const), dueAt: null, source: 'directive' as const }))
  if (last.focusNote?.trim()) items.push({ owner: 'coach', text: `Focus for this session: ${last.focusNote.trim()}`, status: 'open', dueAt: null, source: 'directive' })
  return items
}

// ── Market and strengths ────────────────────────────────────────────────────

async function loadMarket(candidate: Pick<CandidateProfile, 'id' | 'currentCity' | 'currentState' | 'lastSalary'>): Promise<MarketFacts> {
  const occ = (await soft('occupation', () => resolveCandidateOccupation(candidate.id))) ?? { status: 'unavailable' as const }
  const soc = occ.status === 'resolved' ? occ.socCode : null
  const [exposure, pay] = await Promise.all([
    soft('AI exposure', () => loadCandidateExposure(candidate.id)),
    soft('local pay', async () => {
      if (occ.status !== 'resolved') return null
      const area = resolveArea({ city: candidate.currentCity, state: candidate.currentState }, await getAreaCatalog())
      const best = bestPay((await getPayLookup(area))(occ.socCode))
      return best ? { occupationTitle: occ.title, areaName: best.areaName, median: best.median, lastSalary: candidate.lastSalary } : null
    }),
  ])
  return {
    exposure: exposure
      ? { title: exposure.title, score: exposure.score, band: exposure.band, sentence: exposureSentence(exposure), why: EXPOSURE_WHY, sourceName: AI_EXPOSURE_SOURCE.name }
      : null,
    pay,
    cycleLine: soc ? cycleLineForSoc(soc) : null,
  }
}

async function loadTraits(candidateId: string): Promise<TraitFact[]> {
  return buildEvidenceTraits(await loadTraitSignals(candidateId)).map((t) => ({ key: t.key, label: t.label, level: t.level, shownBy: t.shownBy }))
}

// ── The page ────────────────────────────────────────────────────────────────

export interface LoadedPrep {
  view: PrepView
  primary: ReturnType<typeof primaryAction>
  firstName: string
  fullName: string
  weekNumber: number | null
  consented: boolean
  confidential: boolean
  meetUrl: string | null
  bookingTimezone: string | null
}

export async function loadPrep(coach: Pick<Coach, 'id'>, candidate: CandidateProfile, now = new Date()): Promise<LoadedPrep> {
  const consented = candidate.coachDossierConsentedAt !== null
  const confidential = candidate.confidentialSearchMode
  const firstName = candidate.firstName?.trim() || 'this member'
  const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'This member'
  const weekNumber = candidate.registrationCompletedAt ? Math.floor((now.getTime() - candidate.registrationCompletedAt.getTime()) / (7 * DAY_MS)) + 1 : null

  const lastSession = await soft('last session', () => prisma.coachSession.findFirst({ where: { coachId: coach.id, candidateId: candidate.id }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } }))
  const lastSessionAt = lastSession?.occurredAt ?? null
  const since = lastSessionAt ?? new Date(now.getTime() - 7 * DAY_MS)

  // Nothing about the search is read without consent. The coach's own notes (what was agreed) are theirs, so they always load.
  const [session, agreed, effort, pipeline, grade, market, traits] = await Promise.all([
    soft('session', () => loadSession(coach.id, candidate.id, now)),
    soft('agreed items', () => loadAgreed(coach.id, candidate.id)),
    consented ? soft('effort', () => loadEffort(candidate.id, now)) : null,
    consented ? soft('pipeline', () => loadPipeline(candidate.id, confidential, since, now)) : null,
    consented ? soft('grade', () => loadGrade(candidate.id)) : null,
    consented ? soft('market', () => loadMarket(candidate)) : null,
    consented ? soft('strengths', () => loadTraits(candidate.id)) : null,
  ])

  const input: PrepInput = { now, firstName, consented, confidential, weekNumber, session, lastSessionAt, effort, pipeline, grade, agreed, market, traits }
  return {
    view: buildPrep(input),
    primary: primaryAction(session?.meetUrl ?? null),
    firstName,
    fullName,
    weekNumber,
    consented,
    confidential,
    meetUrl: session?.meetUrl ?? null,
    bookingTimezone: session?.timezone ?? null,
  }
}
