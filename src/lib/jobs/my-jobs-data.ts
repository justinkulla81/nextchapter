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
  type MyJobsFunnel,
  type SkillsGapInsight,
} from '@/lib/jobs/my-jobs'
import { loadPostingLifecycles } from '@/lib/jobs/past-jobs-data'
import { lifecycleBadge, lifecycleSentence } from '@/lib/jobs/job-status'

import { mergeMyJobItems, type ApplyPrompt, type CardTrackState, type MyJobItem, type TrackerFields } from '@/lib/jobs/my-jobs-merge'
import { noteKeysFor, parseChecklist } from '@/lib/jobs/tracker'
import { loadKeywordMatches, type KeywordMatchJob } from '@/lib/jobs/keyword-match-server'
import { applicationAnalytics, type ApplicationAnalytics } from '@/lib/jobs/application-analytics'

export { trackKey, type TrackSource, type TrackRef, type CardTrackState, type MyJobItem, type PastListing, type ApplyPrompt, type TrackerFields } from '@/lib/jobs/my-jobs-merge'

export interface MyJobsView {
  items: MyJobItem[]
  prompts: ApplyPrompt[]
  funnel: MyJobsFunnel
  insight: SkillsGapInsight | null
  cardStates: Map<string, CardTrackState>
  watchedCompanies: Set<string>
  /** Applied counts and reply rates, overall and by function and level. */
  analytics?: ApplicationAnalytics
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
  const [tracked, interestedSurfaced, apps, watch, savedPostings] = await Promise.all([
    prisma.trackedJob.findMany({ where: { candidateId }, include: { jobPosting: true }, orderBy: { updatedAt: 'desc' }, take: 500 }),
    prisma.surfacedJob.findMany({
      where: { candidateId, reaction: 'INTERESTED' },
      select: { id: true, title: true, companyName: true, url: true, description: true, reactedAt: true, surfacedAt: true },
    }),
    // Weekly check-in counts are numbers, not jobs: they count toward Candidate+ but aren't listed.
    prisma.jobPosting.findMany({ where: { candidateId, appliedAt: { not: null }, selfReportKey: null }, orderBy: { appliedAt: 'desc' }, take: 500 }),
    prisma.companyWatchlistEntry.findMany({ where: { candidateId }, select: { companyNameNormalized: true } }),
    // Added by address (Add a job) and not applied to yet: listed as saved.
    prisma.jobPosting.findMany({
      where: { candidateId, source: 'MANUAL', appliedAt: null, declinedAt: null, trackedJob: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])

  try {
    await linkEmailApplications(candidateId, tracked, apps)
  } catch (error) {
    // Matching must never take My jobs down; the next load retries.
    console.error('My jobs: linking email applications failed', error)
  }

  const { items, cardStates, prompts, linkedAppIds } = mergeMyJobItems({ tracked, surfaced: interestedSurfaced, apps, savedPostings, now })

  await attachPastListings(items, now)

  const funnel = myJobsFunnel([
    ...tracked.map((t) => ({ clicked: !!t.firstClickedAt, application: t.jobPosting })),
    ...apps.filter((a) => !linkedAppIds.has(a.id)).map((a) => ({ clicked: false, application: a })),
  ])

  const [insight] = await Promise.all([
    loadInsight(items, interestedSurfaced, apps, memberKeywords),
    attachTracker(candidateId, items, { surfaced: interestedSurfaced, apps: [...apps, ...savedPostings] }, memberKeywords),
  ])

  return {
    items,
    prompts: prompts.sort((a, b) => b.clickedAt.getTime() - a.clickedAt.getTime()).slice(0, MAX_APPLY_PROMPTS),
    funnel,
    insight,
    cardStates,
    watchedCompanies: new Set(watch.map((w) => w.companyNameNormalized)),
    analytics: applicationAnalytics(apps, now),
  }
}

/** Live rows get a keyword match; this caps the work on a very long list. */
const MAX_MATCHED_ROWS = 80

/**
 * The member's notes, excitement, follow-up date, checklist and contacts for each row
 * (JobTrackerNote), and a resume keyword match for each open row that has job text. Best-effort:
 * a failed read leaves the rows without them, and My jobs still loads.
 */
async function attachTracker(
  candidateId: string,
  items: MyJobItem[],
  rows: { surfaced: { id: string; title: string; description: string | null }[]; apps: JobPosting[] },
  memberKeywords: string[]
) {
  try {
    const notes = await prisma.jobTrackerNote.findMany({ where: { candidateId } })
    const byKey = new Map(notes.map((n) => [n.itemKey, n]))
    const noteFor = new Map<string, (typeof notes)[number]>()
    for (const i of items) {
      const n = noteKeysFor(i).map((k) => byKey.get(k)).find(Boolean)
      if (n) noteFor.set(i.key, n)
    }
    const contactIds = [...new Set([...noteFor.values()].flatMap((n) => n.contactIds))]
    const contacts = contactIds.length
      ? await prisma.supportNetworkContact.findMany({ where: { candidateId, id: { in: contactIds } }, select: { id: true, name: true, company: true } })
      : []
    const contactById = new Map(contacts.map((c) => [c.id, c]))
    for (const i of items) {
      const n = noteFor.get(i.key)
      if (!n) continue
      const fields: TrackerFields = {
        notes: n.notes,
        excitement: n.excitement,
        followUpAt: n.followUpAt,
        followUpDoneAt: n.followUpDoneAt,
        checklist: parseChecklist(n.checklist),
        contacts: n.contactIds.map((id) => contactById.get(id)).filter((c): c is NonNullable<typeof c> => !!c),
        hasJobText: !!n.jobText,
      }
      i.tracker = fields
    }

    // Keyword match: the job's own text, wherever it lives.
    const live = items.filter((i) => i.status !== 'closed').slice(0, MAX_MATCHED_ROWS)
    const boardIds = live.filter((i) => i.ref?.source === 'job_board').map((i) => i.ref!.sourceId)
    const postings = boardIds.length
      ? await prisma.exclusiveJobPosting.findMany({ where: { id: { in: boardIds } }, select: { id: true, title: true, description: true, skills: true, skillIds: true } })
      : []
    const postingById = new Map(postings.map((p) => [p.id, p]))
    const surfacedById = new Map(rows.surfaced.map((s) => [s.id, s]))
    const appById = new Map(rows.apps.map((a) => [a.id, a]))
    const jobs: KeywordMatchJob[] = []
    for (const i of live) {
      const pasted = noteFor.get(i.key)?.jobText
      if (i.ref?.source === 'job_board') {
        const p = postingById.get(i.ref.sourceId)
        if (p) jobs.push({ key: i.key, jobText: `${p.title}\n${p.description ?? ''}`, jobSkills: p.skills, jobSkillIds: p.skillIds })
      } else if (pasted) {
        jobs.push({ key: i.key, jobText: `${i.title}\n${pasted}` })
      } else if (i.ref?.source === 'surfaced') {
        const s = surfacedById.get(i.ref.sourceId)
        if (s?.description) jobs.push({ key: i.key, jobText: `${s.title}\n${s.description}` })
      } else if (i.jobPostingId) {
        const a = appById.get(i.jobPostingId)
        if (a?.extractedText) jobs.push({ key: i.key, jobText: `${a.title ?? ''}\n${a.extractedText.slice(0, 8000)}` })
      }
    }
    const matches = await loadKeywordMatches(memberKeywords, jobs)
    for (const i of items) {
      const m = matches.get(i.key)
      if (m && (m.matched.length > 0 || m.missing.length > 0)) i.keywordMatch = m
    }
  } catch (error) {
    console.error('My jobs: tracker notes or keyword match unavailable', error)
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
    ? await prisma.exclusiveJobPosting.findMany({ where: { id: { in: boardIds } }, select: { id: true, title: true, description: true, skills: true, aiSkillItems: true } })
    : []
  const byId = new Map(postings.map((p) => [p.id, p]))
  const surfacedById = new Map(surfaced.map((s) => [s.id, s]))
  const appById = new Map(apps.map((a) => [a.id, a]))
  const gaps: { id: string; gap: JobSkillGap }[] = []
  for (const i of live) {
    let input: { title: string; description: string | null; skills?: string[]; aiSkillItems?: string[] } | null = null
    if (i.ref?.source === 'job_board') {
      const p = byId.get(i.ref.sourceId)
      if (p) input = { title: p.title, description: p.description, skills: p.skills, aiSkillItems: p.aiSkillItems }
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
