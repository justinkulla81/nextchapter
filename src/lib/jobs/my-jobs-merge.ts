// One list of the member's jobs (My jobs): board saves and applies (TrackedJob), partner-search jobs
// marked Interested (SurfacedJob), applications found in Gmail or logged in the tracker (JobPosting with
// appliedAt), and jobs added by address that are not applied to yet (JobPosting MANUAL, saved). A Gmail
// confirmation linked to a board job is one row, never two. Pure — loadMyJobs (my-jobs-data.ts) reads the
// rows and links Gmail applications first. Tests: src/test/my-jobs-merge.test.ts.

import type { JobLifecycleStatus } from '@/lib/jobs/job-status'
import { applicationStatus, shouldAskDidYouApply, type ApplicationDates, type ApplicationStatus, type JobStatus } from '@/lib/jobs/my-jobs'
import { classifyWorkType, isWorkType, type JobWorkType } from '@/lib/jobs/work-type'
import type { KeywordMatch } from '@/lib/jobs/keyword-match'
import type { Checklist } from '@/lib/jobs/tracker'

/** Which board a tracked job came from — same values as JobClickEvent.source, plus 'external' (saved from another site). */
export type TrackSource = 'job_board' | 'surfaced' | 'matched_role' | 'external'

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

/** The member's own tracker fields for a row (JobTrackerNote), when they have set any. */
export interface TrackerFields {
  notes: string | null
  excitement: number | null
  followUpAt: Date | null
  followUpDoneAt: Date | null
  checklist: Checklist
  contacts: { id: string; name: string; company: string | null }[]
  /** A posting text was pasted for this job (a job saved from another site). */
  hasJobText: boolean
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
  /** Notes, excitement, follow-up date, checklist and contacts; null until the member sets one. */
  tracker?: TrackerFields | null
  /** Resume keyword match against the job, when the job has text to match. */
  keywordMatch?: KeywordMatch | null
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

export const NEXT_STEP: Record<JobStatus, string> = {
  saved: 'Apply, or ask someone there for an intro',
  applied: 'Follow up in a week if you have not heard back',
  interviewing: 'Prepare for the next conversation',
  offer: 'Compare the offer and negotiate',
  closed: 'Nothing to do',
}

export interface MergeApplication extends ApplicationDates {
  id: string
  source: string
  title: string | null
  companyName: string | null
  url: string | null
  createdAt: Date
}

export interface MergeTracked {
  id: string
  source: string
  sourceId: string
  title: string
  companyName: string | null
  url: string | null
  workType: string | null
  savedAt: Date | null
  firstClickedAt: Date | null
  lastClickedAt: Date | null
  appliedVia: string | null
  promptAnswer: string | null
  promptAnsweredAt: Date | null
  dismissedAt: Date | null
  updatedAt: Date
  jobPosting: MergeApplication | null
}

export interface MergeSurfaced {
  id: string
  title: string
  companyName: string | null
  url: string | null
  description: string | null
  reactedAt: Date | null
  surfacedAt: Date
}

export interface MergeInput {
  tracked: MergeTracked[]
  surfaced: MergeSurfaced[]
  /** Applications (appliedAt set), self-reported counts already excluded. */
  apps: MergeApplication[]
  /** Jobs added by address and not applied to yet (JobPosting MANUAL, appliedAt null, not declined). */
  savedPostings?: MergeApplication[]
  now: Date
}

export interface MergeResult {
  items: MyJobItem[]
  cardStates: Map<string, CardTrackState>
  prompts: ApplyPrompt[]
  linkedAppIds: Set<string>
}

function dateOf(status: JobStatus, savedAt: Date | null, app: ApplicationDates | null, fallback: Date): Date {
  if (!app) return savedAt ?? fallback
  if (status === 'closed') return app.declinedAt ?? fallback
  if (status === 'offer') return app.offerReceivedAt ?? fallback
  if (status === 'interviewing') return app.interviewLandedAt ?? fallback
  return app.appliedAt ?? savedAt ?? fallback
}

export function refOf(t: Pick<MergeTracked, 'source' | 'sourceId' | 'title' | 'companyName' | 'url' | 'workType'>): TrackRef {
  return {
    source: t.source as TrackSource,
    sourceId: t.sourceId,
    title: t.title,
    companyName: t.companyName,
    url: t.url,
    workType: isWorkType(t.workType) ? t.workType : classifyWorkType({ title: t.title }),
  }
}

const ORDER: Record<JobStatus, number> = { offer: 0, interviewing: 1, applied: 2, saved: 3, closed: 4 }

export function mergeMyJobItems({ tracked, surfaced, apps, savedPostings = [], now }: MergeInput): MergeResult {
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
      origin: t.appliedVia === 'email' ? 'email' : t.source === 'external' ? 'tracker' : 'board',
      appliedVia: t.appliedVia,
      date: dateOf(status, t.savedAt, app, t.updatedAt),
      nextStep: NEXT_STEP[status],
      ref: refOf(t),
      listing: null,
    })
  }

  // Surfaced jobs marked Interested before My jobs existed (or from the old list).
  for (const s of surfaced) {
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
    const status = applicationStatus(a)
    if (!status) continue
    linkedAppIds.add(a.id)
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

  // Jobs added by address that the member has not applied to yet: saved, like a board save.
  for (const p of savedPostings) {
    if (linkedAppIds.has(p.id) || applicationStatus(p)) continue
    linkedAppIds.add(p.id)
    items.push({
      key: `posting:${p.id}`,
      trackedJobId: null,
      jobPostingId: p.id,
      title: p.title || p.companyName || 'Job you added',
      companyName: p.companyName,
      url: p.url,
      workType: p.title ? classifyWorkType({ title: p.title }) : null,
      status: 'saved',
      origin: 'tracker',
      appliedVia: null,
      date: p.createdAt,
      nextStep: NEXT_STEP.saved,
      ref: null,
      listing: null,
    })
  }

  items.sort((x, y) => ORDER[x.status] - ORDER[y.status] || y.date.getTime() - x.date.getTime())
  return { items, cardStates, prompts, linkedAppIds }
}
