import 'server-only'
import type { JobPosting, TrackedJob } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { jobSkillGap, type JobSkillGap } from '@/lib/jobs/job-skill-gap'
import {
  applicationStatus,
  matchClickToApplication,
  myJobsFunnel,
  shouldAskDidYouApply,
  PROMPT_UNTIL_DAYS,
  skillsGapInsight,
  type ApplicationStatus,
  type JobStatus,
  type MyJobsFunnel,
  type SkillsGapInsight,
} from '@/lib/jobs/my-jobs'
import { classifyWorkType, isWorkType, type JobWorkType } from '@/lib/jobs/work-type'
import { loadPostingLifecycles } from '@/lib/jobs/past-jobs-data'
import { lifecycleBadge, lifecycleSentence, type JobLifecycleStatus } from '@/lib/jobs/job-status'

/** Which board a tracked job came from — same values as JobClickEvent.source. */
export type TrackSource = 'job_board' | 'surfaced' | 'matched_role'

export interface TrackRef {
  source: TrackSource
  sourceId: string
  title: string
  companyName: string | null
  url: string | null
  workType: JobWorkType
}

export const trackKey = (source: string, sourceId: string) => `${source}:${sourceId}`

/** What a board card needs to render its Save / Applied controls. */
export interface CardTrackState {
  saved: boolean
  status: ApplicationStatus | null
}

export interface MyJobItem {
  key: string
  trackedJobId: string | null
  jobPostingId: string | null
  title: string
  companyName: string | null
  url: string | null
  workType: JobWorkType | null
  status: JobStatus
  /** Where we learned of it: saved on the board, applied on the board, found in Gmail, or logged in the tracker. */
  origin: 'board' | 'email' | 'tracker'
  appliedVia: string | null
  /** Saved / applied / last status date. */
  date: Date
  nextStep: string
  ref: TrackRef | null
  /** For a board job that has closed or aged out since it was saved (job-status.ts); null while it is live. */
  listing: PastListing | null
}

/** A saved/applied board job that is no longer listed: shown with a status banner, never silently dropped. */
export interface PastListing {
  status: Extract<JobLifecycleStatus, 'closed' | 'expired'>
  badge: string
  sentence: string
  closedAt: Date
}

export interface ApplyPrompt {
  trackedJobId: string
  title: string
  companyName: string | null
  clickedAt: Date
}

export interface MyJobsView {
  items: MyJobItem[]
  prompts: ApplyPrompt[]
  funnel: MyJobsFunnel
  insight: SkillsGapInsight | null
  cardStates: Map<string, CardTrackState>
  watchedCompanies: Set<string>
}

const NEXT_STEP: Record<JobStatus, string> = {
  saved: 'Apply, or ask someone there for an intro',
  applied: 'Follow up in a week if you have not heard back',
  interviewing: 'Prepare for the next conversation',
  offer: 'Compare the offer and negotiate',
  closed: 'Nothing to do',
}

function dateOf(status: JobStatus, savedAt: Date | null, app: JobPosting | null, fallback: Date): Date {
  if (!app) return savedAt ?? fallback
  if (status === 'closed') return app.declinedAt ?? fallback
  if (status === 'offer') return app.offerReceivedAt ?? fallback
  if (status === 'interviewing') return app.interviewLandedAt ?? fallback
  return app.appliedAt ?? fallback
}

function refOf(t: TrackedJob): TrackRef {
  return {
    source: t.source as TrackSource,
    sourceId: t.sourceId,
    title: t.title,
    companyName: t.companyName,
    url: t.url,
    workType: isWorkType(t.workType) ? t.workType : classifyWorkType({ title: t.title }),
  }
}

/**
 * Links Gmail-detected applications to the board job the member opened the
 * application for: an apply click followed within 14 days by a confirmation from
 * the same company (and role, when the email names one). Idempotent — a linked
 * application is never linked again — so it runs on every My jobs load and fires
 * application_auto_detected once per job. Email content never leaves the server;
 * only the match is stored.
 */
async function linkEmailApplications(candidateId: string, tracked: (TrackedJob & { jobPosting: JobPosting | null })[], apps: JobPosting[]) {
  const linkedIds = new Set(tracked.map((t) => t.jobPostingId).filter(Boolean))
  const free = apps.filter((a) => a.source === 'EMAIL_DETECTED' && !linkedIds.has(a.id))
  for (const t of tracked) {
    if (t.jobPostingId || !t.firstClickedAt || free.length === 0) continue
    const match = matchClickToApplication(
      { companyName: t.companyName, title: t.title, clickedAt: t.firstClickedAt },
      free.map((a) => ({ id: a.id, companyName: a.companyName, title: a.title, appliedAt: a.appliedAt }))
    )
    if (!match) continue
    const app = free.find((a) => a.id === match.id)!
    free.splice(free.indexOf(app), 1)
    // A confirmation subject rarely names the role; the board job does.
    const updates: Promise<unknown>[] = [
      prisma.trackedJob.update({ where: { id: t.id }, data: { jobPostingId: app.id, appliedVia: 'email' } }),
    ]
    if (!app.title || !app.url) {
      updates.push(prisma.jobPosting.update({ where: { id: app.id }, data: { title: app.title ?? t.title, url: app.url ?? t.url } }))
    }
    await Promise.all(updates)
    t.jobPostingId = app.id
    t.jobPosting = { ...app, title: app.title ?? t.title, url: app.url ?? t.url }
    t.appliedVia = 'email'
    captureServerEvent(candidateId, 'application_auto_detected', {
      jobId: t.sourceId,
      trackedJobId: t.id,
      jobPostingId: app.id,
      source: t.source,
      via: 'email',
      daysAfterClick: Math.round(((app.appliedAt?.getTime() ?? 0) - t.firstClickedAt.getTime()) / 86_400_000),
    })
  }
}

/** At most this many opened jobs in the one batched "Did you apply?" prompt. */
export const MAX_APPLY_PROMPTS = 5

/**
 * The "Did you apply?" prompt for Home: only the jobs opened in the last 7 days with no
 * application yet. Links Gmail-detected applications first (the same matcher My jobs runs),
 * so a job Gmail already logged is never asked about.
 */
export async function loadApplyPrompts(candidateId: string, now: Date = new Date()): Promise<ApplyPrompt[]> {
  const since = new Date(now.getTime() - PROMPT_UNTIL_DAYS * 86_400_000)
  const tracked = await prisma.trackedJob.findMany({
    where: { candidateId, lastClickedAt: { gte: since }, jobPostingId: null, dismissedAt: null },
    include: { jobPosting: true },
    orderBy: { lastClickedAt: 'desc' },
    take: 50,
  })
  if (tracked.length === 0) return []
  try {
    const emailApps = await prisma.jobPosting.findMany({
      where: { candidateId, source: 'EMAIL_DETECTED', appliedAt: { gte: new Date(since.getTime() - 86_400_000) }, trackedJob: null },
    })
    if (emailApps.length > 0) await linkEmailApplications(candidateId, tracked, emailApps)
  } catch (error) {
    console.error('Apply prompts: linking email applications failed', error)
  }
  return tracked
    .filter((t) => shouldAskDidYouApply({ ...t, applied: !!applicationStatus(t.jobPosting) }, now))
    .slice(0, MAX_APPLY_PROMPTS)
    .map((t) => ({ trackedJobId: t.id, title: t.title, companyName: t.companyName, clickedAt: t.lastClickedAt! }))
}

export async function loadMyJobs(
  candidateId: string,
  memberKeywords: string[],
  now: Date = new Date()
): Promise<MyJobsView> {
  const [tracked, interestedSurfaced, apps, watch] = await Promise.all([
    prisma.trackedJob.findMany({ where: { candidateId }, include: { jobPosting: true }, orderBy: { updatedAt: 'desc' }, take: 500 }),
    prisma.surfacedJob.findMany({
      where: { candidateId, reaction: 'INTERESTED' },
      select: { id: true, title: true, companyName: true, url: true, description: true, reactedAt: true, surfacedAt: true },
    }),
    // Weekly check-in counts are numbers, not jobs: they count toward Candidate+ but aren't listed.
    prisma.jobPosting.findMany({ where: { candidateId, appliedAt: { not: null }, selfReportKey: null }, orderBy: { appliedAt: 'desc' }, take: 500 }),
    prisma.companyWatchlistEntry.findMany({ where: { candidateId }, select: { companyNameNormalized: true } }),
  ])

  try {
    await linkEmailApplications(candidateId, tracked, apps)
  } catch (error) {
    // Matching must never take My jobs down; the next load retries.
    console.error('My jobs: linking email applications failed', error)
  }

  const items: MyJobItem[] = []
  const cardStates = new Map<string, CardTrackState>()
  const prompts: ApplyPrompt[] = []
  const linkedAppIds = new Set<string>()
  const trackedKeys = new Set<string>()

  for (const t of tracked) {
    const key = trackKey(t.source, t.sourceId)
    trackedKeys.add(key)
    const app = t.jobPosting
    if (app) linkedAppIds.add(app.id)
    const appStatus = applicationStatus(app)
    cardStates.set(key, { saved: !!t.savedAt, status: appStatus })
    if (shouldAskDidYouApply({ ...t, applied: !!appStatus }, now)) {
      prompts.push({ trackedJobId: t.id, title: t.title, companyName: t.companyName, clickedAt: t.lastClickedAt! })
    }
    if (t.dismissedAt && !appStatus) continue
    const status: JobStatus | null = appStatus ?? (t.savedAt ? 'saved' : null)
    if (!status) continue // opened only: shows as a prompt, not a job
    items.push({
      key,
      trackedJobId: t.id,
      jobPostingId: app?.id ?? null,
      title: t.title,
      companyName: t.companyName,
      url: t.url,
      workType: isWorkType(t.workType) ? t.workType : null,
      status,
      origin: t.appliedVia === 'email' ? 'email' : 'board',
      appliedVia: t.appliedVia,
      date: dateOf(status, t.savedAt, app, t.updatedAt),
      nextStep: NEXT_STEP[status],
      ref: refOf(t),
      listing: null,
    })
  }

  // Surfaced jobs marked Interested before My jobs existed (or from the old list).
  for (const s of interestedSurfaced) {
    const key = trackKey('surfaced', s.id)
    if (trackedKeys.has(key)) continue
    cardStates.set(key, { saved: true, status: null })
    const workType = classifyWorkType({ title: s.title, description: s.description })
    items.push({
      key,
      trackedJobId: null,
      jobPostingId: null,
      title: s.title,
      companyName: s.companyName,
      url: s.url,
      workType,
      status: 'saved',
      origin: 'board',
      appliedVia: null,
      date: s.reactedAt ?? s.surfacedAt,
      nextStep: NEXT_STEP.saved,
      ref: { source: 'surfaced', sourceId: s.id, title: s.title, companyName: s.companyName, url: s.url, workType },
      listing: null,
    })
  }

  // Every other application: found in Gmail, or logged in the Application Tracker.
  for (const a of apps) {
    if (linkedAppIds.has(a.id)) continue
    const status = applicationStatus(a)!
    items.push({
      key: `application:${a.id}`,
      trackedJobId: null,
      jobPostingId: a.id,
      title: a.title || a.companyName || 'Application',
      companyName: a.companyName,
      url: a.url,
      workType: a.title ? classifyWorkType({ title: a.title }) : null,
      status,
      origin: a.source === 'EMAIL_DETECTED' ? 'email' : 'tracker',
      appliedVia: a.source === 'EMAIL_DETECTED' ? 'email' : 'manual',
      date: dateOf(status, null, a, a.createdAt),
      nextStep: NEXT_STEP[status],
      ref: null,
      listing: null,
    })
  }

  await attachPastListings(items, now)

  const order: Record<JobStatus, number> = { offer: 0, interviewing: 1, applied: 2, saved: 3, closed: 4 }
  items.sort((x, y) => order[x.status] - order[y.status] || y.date.getTime() - x.date.getTime())

  const funnel = myJobsFunnel([
    ...tracked.map((t) => ({ clicked: !!t.firstClickedAt, application: t.jobPosting })),
    ...apps.filter((a) => !linkedAppIds.has(a.id)).map((a) => ({ clicked: false, application: a })),
  ])

  const insight = await loadInsight(items, interestedSurfaced, apps, memberKeywords)

  return {
    items,
    prompts: prompts.sort((a, b) => b.clickedAt.getTime() - a.clickedAt.getTime()).slice(0, MAX_APPLY_PROMPTS),
    funnel,
    insight,
    cardStates,
    watchedCompanies: new Set(watch.map((w) => w.companyNameNormalized)),
  }
}

/**
 * Marks board jobs that have closed or aged out since the member saved or applied
 * (job-status.ts) — My jobs shows them with a banner and alternatives instead of
 * letting them silently disappear. Best-effort: a failed read leaves them unmarked.
 */
async function attachPastListings(items: MyJobItem[], now: Date) {
  const ids = items.filter((i) => i.ref?.source === 'job_board').map((i) => i.ref!.sourceId)
  if (ids.length === 0) return
  try {
    const lives = await loadPostingLifecycles(ids, now)
    for (const i of items) {
      if (i.ref?.source !== 'job_board') continue
      const l = lives.get(i.ref.sourceId)
      if (!l || !l.isPast || !l.closedAt || (l.status !== 'closed' && l.status !== 'expired')) continue
      i.listing = { status: l.status, badge: lifecycleBadge(l), sentence: lifecycleSentence(l) ?? '', closedAt: l.closedAt }
    }
  } catch (error) {
    console.error('My jobs: could not load listing status', error)
  }
}

/** Skills the member's saved and applied jobs keep asking for that they don't show. */
async function loadInsight(
  items: MyJobItem[],
  surfaced: { id: string; title: string; description: string | null }[],
  apps: JobPosting[],
  memberKeywords: string[]
): Promise<SkillsGapInsight | null> {
  const live = items.filter((i) => i.status !== 'closed')
  const boardIds = live.filter((i) => i.ref?.source === 'job_board').map((i) => i.ref!.sourceId)
  const postings = boardIds.length
    ? await prisma.exclusiveJobPosting.findMany({ where: { id: { in: boardIds } }, select: { id: true, title: true, description: true, skills: true } })
    : []
  const byId = new Map(postings.map((p) => [p.id, p]))
  const surfacedById = new Map(surfaced.map((s) => [s.id, s]))
  const appById = new Map(apps.map((a) => [a.id, a]))
  const gaps: { id: string; gap: JobSkillGap }[] = []
  for (const i of live) {
    let input: { title: string; description: string | null; skills?: string[] } | null = null
    if (i.ref?.source === 'job_board') {
      const p = byId.get(i.ref.sourceId)
      if (p) input = { title: p.title, description: p.description, skills: p.skills }
    } else if (i.ref?.source === 'surfaced') {
      const s = surfacedById.get(i.ref.sourceId)
      if (s) input = { title: s.title, description: s.description }
    } else if (i.jobPostingId) {
      const a = appById.get(i.jobPostingId)
      if (a?.extractedText) input = { title: a.title ?? '', description: a.extractedText.slice(0, 6000) }
    }
    if (input) gaps.push({ id: i.key, gap: jobSkillGap({ ...input, memberKeywords }) })
  }
  return skillsGapInsight(gaps)
}

/** Companies the member watches, keyed like CompanyWatchlistEntry.companyNameNormalized. */
export function isWatched(watched: Set<string>, companyName: string | null): boolean {
  return !!companyName && watched.has(normalizeOrgName(companyName))
}
