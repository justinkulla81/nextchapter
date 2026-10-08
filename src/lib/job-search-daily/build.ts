import 'server-only'
import type { CandidateProfile } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch } from '@/lib/text/org-name-match'
import {
  getCurrentWeekSprint,
  getCandidateWeekNumber,
  getMondayOfWeek,
  type CommittedAction,
} from '@/lib/weekly/sprint'
import { isProfileChecklistActionType } from '@/lib/weekly/profile-checklist-types'
import { computeWeeklyEngines } from '@/lib/scoring/dossier-competencies'
import { isDossierUnlocked } from '@/lib/scoring/dossier-unlock'
import { computeBoardListingFitBucket } from '@/lib/jobs/job-fit-bucket'
import { digestClickUrl } from '@/lib/email/digest-click-url'
import { getUnifiedFollowUps } from '@/lib/dashboard/unified-follow-ups'
import {
  UNLOCK_NUDGES,
  UNLOCK_REPEAT_DAYS,
  ACTION_BUTTONS,
  QUOTES,
  QUOTE_REPEAT_DAYS,
  seededRandom,
  type RotationContext,
  type Quote,
} from './rotations'

// Job Search Daily — one short email a day, built from things that are
// actually new for this candidate since the last one. Every item shown is
// logged in JobSearchDailyItem and never shown again, which is the whole
// anti-repetition mechanism; sections with nothing new are dropped rather
// than padded. No LLM call anywhere in here (founder decision, 2026-10-07).

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_TODOS = 3
const MAX_JOBS = 3
const JOB_LOOKBACK_DAYS = 7 // first send, or a candidate returning after a gap
const ARTICLE_LOOKBACK_DAYS = 21
const COMPANY_MOVE_MIN_DELTA = 3 // open roles up by at least this many over 4 weeks…
const COMPANY_MOVE_MIN_SHARE = 0.15 // …and by at least this share, so a small swing at a giant isn't "news"
const MAX_STALE_SHOWN = 3
const MAX_PRIORITIES = 3
const MAX_APPS_SHOWN = 3
const APPLICATION_MAX_AGE_DAYS = 30 // past this, "follow up" is stale — it's a close-out, not a nudge
const INTERVIEW_SOON_DAYS = 7
const DISPLAY_TZ = 'America/New_York'

export interface DailyTodo {
  text: string
  points: number
}

export interface DailyItem {
  key: string // JobSearchDailyItem.itemKey
  title: string
  detail: string | null
  href: string | null
}

// One line in "Top 3 today": the clock first (why now), then the action.
export interface DailyPriority {
  key: string
  lead: string
  text: string
  href: string
}

export type ScoreStatus = 'locked' | 'onTrack' | 'behind' | 'atRisk'

export interface JobSearchDailyContent {
  firstName: string | null
  streak: number // consecutive check-in days
  dayNumber: number | null
  score: { earned: number; target: number; status: ScoreStatus } | null
  priorities: DailyPriority[] // top few things to do today, ranked by urgency; also removed from the lists below
  todos: DailyTodo[]
  applications: DailyItem[] // recent applications application waiting on a reply — tasks, so never deduped
  applicationsMoreCount: number
  staleApplicationCount: number // applied 30+ days ago, no word: close out, don't chase
  networking: DailyItem[] // replies owed, starred people due a note, a contact at a hiring company, a few stale contacts
  networkingMoreCount: number // stale contacts beyond the few shown
  jobs: { items: DailyItem[]; lockedCount: number }
  companyMoves: DailyItem[]
  reconnect: DailyItem | null
  article: DailyItem | null
  unlock: DailyItem | null
  action: { label: string; href: string }
  quote: Quote | null
  freshCount: number // new items (jobs, company moves, contact, article) — 0 means nothing new today
}

type Candidate = CandidateProfile

export async function buildJobSearchDaily(candidate: Candidate, now = new Date()): Promise<JobSearchDailyContent> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  // ?src= lets PostHog pageviews attribute clicks back to this email.
  const jobsUrl = `${appUrl}/dashboard/find-my-job?src=job_search_daily`
  const networkUrl = `${appUrl}/dashboard/network?src=job_search_daily`

  const [shown, lastSend, contacts, appliedCompanies, watchlist, weekNumber] = await Promise.all([
    prisma.jobSearchDailyItem.findMany({
      where: { candidateId: candidate.id },
      select: { itemKey: true, shownAt: true },
    }),
    prisma.candidateEmailSendLog.findFirst({
      where: { candidateId: candidate.id, emailKey: 'JOB_SEARCH_DAILY' },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    }),
    prisma.supportNetworkContact.findMany({
      where: {
        candidateId: candidate.id,
        removedAt: null,
        OR: [{ company: { not: null } }, { inferredCompany: { not: null } }],
      },
      select: {
        id: true,
        name: true,
        company: true,
        inferredCompany: true,
        isPriority: true,
        warmth: true,
      },
    }),
    prisma.jobPosting.findMany({
      where: { candidateId: candidate.id, companyName: { not: null } },
      select: { companyName: true },
    }),
    prisma.companyWatchlistEntry.findMany({
      where: { candidateId: candidate.id },
      select: { companyName: true },
    }),
    getCandidateWeekNumber(candidate.id, getMondayOfWeek(now)),
  ])

  const shownKeys = new Set(shown.map((s) => s.itemKey))
  const contactsAt = (companyName: string) =>
    contacts.filter(
      (c) =>
        (c.company && orgNamesMatch(c.company, companyName)) ||
        (c.inferredCompany && orgNamesMatch(c.inferredCompany, companyName))
    )
  const knowLine = (companyName: string) => {
    const n = contactsAt(companyName).length
    return n === 0 ? null : `you know ${n}`
  }

  // ── Score + today's 3 ─────────────────────────────────────────────────
  const [sprint, engines] = await Promise.all([
    getCurrentWeekSprint(candidate.id),
    computeWeeklyEngines(candidate.id, weekNumber, candidate.privacyTier, candidate.confidentialSearchMode),
  ])
  const actions = sprint ? ((sprint.committedActions as unknown as CommittedAction[]) ?? []) : []
  const todos: DailyTodo[] = actions
    .filter((a) => !a.completed && !a.isGoalBonus && !isProfileChecklistActionType(a.actionType))
    .sort((a, b) => b.points - a.points)
    .slice(0, MAX_TODOS)
    .map((a) => ({ text: a.text, points: a.points }))
  const score = sprint
    ? {
        earned: engines.weeklyPoints,
        target: engines.weeklyPointsTarget,
        status: scoreStatus(engines.weeklyPoints, engines.weeklyPointsTarget, now),
      }
    : null

  // ── New roles that fit ───────────────────────────────────────────────
  const jobsSince = lastSend ? lastSend.sentAt : new Date(now.getTime() - JOB_LOOKBACK_DAYS * DAY_MS)
  const [postings, dossier] = await Promise.all([
    prisma.exclusiveJobPosting.findMany({
      where: {
        status: 'approved',
        archivedAt: null,
        distribution: { not: 'EXCLUDED' },
        createdAt: { gte: jobsSince },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    isDossierUnlocked(candidate.id),
  ])
  const fitting = postings.filter((p) => {
    if (shownKeys.has(`job:${p.id}`)) return false
    const bucket = computeBoardListingFitBucket(candidate, p)
    return bucket === 'strong' || bucket === 'good'
  })
  const openable = fitting.filter((p) => p.audienceTier !== 'A_LIST_ONLY' || dossier.unlocked)
  const jobItems: DailyItem[] = openable.slice(0, MAX_JOBS).map((p) => ({
    key: `job:${p.id}`,
    title: p.title,
    detail: [p.companyName, p.location, knowLine(p.companyName)].filter(Boolean).join(' · '),
    href: jobsUrl,
  }))
  const lockedCount = fitting.length - openable.length

  // ── Moves at the companies you're tracking ────────────────────────────
  // "Tracking" = Company Tracker watchlist plus anywhere they've applied.
  const trackedNames = dedupeOrgNames([
    ...watchlist.map((w) => w.companyName),
    ...appliedCompanies.map((j) => j.companyName!),
  ])
  const weekStart = getMondayOfWeek(now)
  const companyMoves: DailyItem[] = []
  if (trackedNames.length > 0) {
    const signals = await prisma.companySignal.findMany({
      where: { weekStartDate: weekStart },
      include: { company: { select: { id: true, name: true } } },
    })
    for (const name of trackedNames) {
      const signal = signals.find((s) => orgNamesMatch(s.company.name, name))
      const key = signal ? `co:${signal.company.id}:${weekStart.toISOString().slice(0, 10)}` : null
      if (!signal || !key || shownKeys.has(key)) continue
      const before = signal.openRolesTotal - signal.rolesDelta4wk
      // Only growth — a company pulling back isn't a reason to act today.
      if (
        signal.rolesDelta4wk < COMPANY_MOVE_MIN_DELTA ||
        signal.rolesDelta4wk < Math.max(before, 1) * COMPANY_MOVE_MIN_SHARE
      )
        continue
      // The Company record's name, not however the candidate typed it.
      const display = signal.company.name
      companyMoves.push({
        key,
        title: `${display} is hiring more`,
        detail: [`${before} → ${signal.openRolesTotal} open roles`, knowLine(display)].filter(Boolean).join(' · '),
        href: jobsUrl,
      })
    }
  }

  // ── Someone in your network at a company that's hiring ────────────────
  // Only companies with an open role this candidate fits, or a tracked
  // company whose hiring is going up — so the nudge always comes with a
  // reason to reach out, never a random name.
  const growingTracked = companyMoves
    .filter((m) => m.title.endsWith('is hiring more'))
    .map((m) => m.title.replace(/ is hiring more$/, ''))
  const hiringCompanies = dedupeOrgNames([...fitting.map((p) => p.companyName), ...growingTracked])
  const fitCompanies = new Set(fitting.map((p) => p.companyName))
  let reconnect: DailyItem | null = null
  for (const company of hiringCompanies) {
    const candidates = contactsAt(company)
      .filter((c) => !shownKeys.has(`contact:${c.id}`))
      .sort((a, b) => Number(b.isPriority) - Number(a.isPriority) || warmthRank(b.warmth) - warmthRank(a.warmth))
    if (candidates[0]) {
      reconnect = {
        key: `contact:${candidates[0].id}`,
        title: `${candidates[0].name}, ${company}`,
        detail: fitCompanies.has(company) ? 'just posted a role that fits you' : 'hiring more right now',
        href: networkUrl,
      }
      break
    }
  }

  // ── Worth 3 minutes ────────────────────────────────────────────────────
  // Published News only: the research inbox is mostly unreviewed, and an
  // email that's meant to be no-fluff can't feature an unvetted article.
  const articleRow = await prisma.researchLibraryItem.findFirst({
    where: {
      newsPublishedAt: {
        gte: new Date(now.getTime() - ARTICLE_LOOKBACK_DAYS * DAY_MS),
      },
      digestAudiences: { has: 'CANDIDATE' },
      // NextChapter's own report editions (and their correction notices)
      // live on the News page, but they aren't candidate reading.
      OR: [{ newsKind: null }, { newsKind: { not: 'report' } }],
      // Layoff stories are demotivating in a morning email (founder call).
      NOT: [
        { newsTitle: { contains: 'laid off', mode: 'insensitive' } },
        { newsTitle: { contains: 'layoff', mode: 'insensitive' } },
        { title: { contains: 'laid off', mode: 'insensitive' } },
        { title: { contains: 'layoff', mode: 'insensitive' } },
      ],
      id: {
        notIn: [...shownKeys].filter((k) => k.startsWith('article:')).map((k) => k.slice('article:'.length)),
      },
    },
    orderBy: { newsPublishedAt: 'desc' },
    select: {
      id: true,
      newsTitle: true,
      title: true,
      newsBlurb: true,
      newsSource: true,
    },
  })
  const article: DailyItem | null =
    articleRow && (articleRow.newsTitle ?? articleRow.title)
      ? {
          key: `article:${articleRow.id}`,
          title: (articleRow.newsTitle ?? articleRow.title)!,
          detail: articleRow.newsSource ?? null,
          href: digestClickUrl('candidate', candidate.id, articleRow.id),
        }
      : null

  // ── Follow-ups and starred people ─────────────────────────────────────
  const withSrc = (href: string) =>
    href.startsWith('http') ? href : `${appUrl}${href}${href.includes('?') ? '&' : '?'}src=job_search_daily`
  const followUpRows = await getUnifiedFollowUps(candidate.id, 50, {
    applicationMaxAgeDays: APPLICATION_MAX_AGE_DAYS,
  })
  const toItem = (f: (typeof followUpRows)[number], detail: string | null): DailyItem => ({
    key: `fu:${f.kind}:${f.id}`,
    title: f.title,
    detail,
    href: withSrc(f.href),
  })
  const applications = followUpRows
    .filter((f) => f.kind === 'unanswered-application')
    .map((f) => {
      // subtitle is "<company> — applied <date>, no word yet"
      const company = f.subtitle.split(' — applied ')[0]
      const applied = f.date
        ? `applied ${f.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        : null
      // Untitled applications read better as the company name.
      return toItem(
        { ...f, title: f.title === 'Application' ? company : f.title },
        f.title === 'Application' ? applied : [company, applied].filter(Boolean).join(', ')
      )
    })
  const repliesOwed = followUpRows.filter((f) => f.kind === 'needs-follow-up').map((f) => toItem(f, f.subtitle))
  const starred = followUpRows
    .filter((f) => f.kind === 'starred-contact')
    .map((f) =>
      toItem(
        { ...f, title: `★ ${f.title}` },
        f.subtitle.replace(/^Starred — /, '').replace(/^Starred contact$/, '') || null
      )
    )
  // Synced contacts include automated senders ("LinkedIn Job Alerts") —
  // never tell someone to reconnect with a mailing list.
  const stale = followUpRows
    .filter((f) => f.kind === 'stale-contact' && !/\b(alerts?|no-?reply|notifications?|newsletter)\b/i.test(f.title))
    .map((f) => toItem(f, f.subtitle.replace(/^Haven't connected in a while( — )?/, '') || null))
  const networking = [...repliesOwed, ...starred, ...(reconnect ? [reconnect] : []), ...stale.slice(0, MAX_STALE_SHOWN)]
  const networkingMoreCount = Math.max(0, stale.length - MAX_STALE_SHOWN)

  // ── Interviews: tie the generic to-dos to something real ──────────────
  // Only interviews for a job the candidate told us about (they marked "I got
  // an interview"), never a calendar guess — a school or press "interview" on
  // the calendar must not trigger prep. A booked time wins over an invite
  // with no time yet.
  const interviewRows = followUpRows.filter((f) => f.needsKind === 'interview')
  const upcomingInterview =
    interviewRows.find(
      (f) =>
        f.scheduledTime &&
        f.scheduledTime.getTime() >= now.getTime() &&
        f.scheduledTime.getTime() <= now.getTime() + INTERVIEW_SOON_DAYS * DAY_MS
    ) ?? interviewRows.find((f) => !f.scheduledTime)
  const interviewCompany = upcomingInterview ? (upcomingInterview.title.split(' at ')[1] ?? null) : null
  const interviewWhen = upcomingInterview?.scheduledTime ? relativeDay(upcomingInterview.scheduledTime, now) : null
  const todosForToday: DailyTodo[] =
    upcomingInterview && interviewWhen
      ? todos.map((t) =>
          /mock interview/i.test(t.text)
            ? {
                ...t,
                text: `${t.text} before your ${interviewCompany ?? 'next'} interview ${interviewWhen}`,
              }
            : t
        )
      : todos

  // ── Top 3 today ───────────────────────────────────────────────────────
  // Ranked by how much waiting costs: a booked interview, then a person
  // waiting on a reply, then a thank-you window, then a warm door that just
  // opened, then an application going cold, then the highest-value to-do.
  const topHref = (href: string) => href.replace('src=job_search_daily', 'src=job_search_daily_top3')
  const daysSince = (d: Date | null) => (d ? Math.max(0, Math.floor((now.getTime() - d.getTime()) / DAY_MS)) : null)
  const candidatesForTop: DailyPriority[] = []
  if (upcomingInterview) {
    candidatesForTop.push({
      key: `fu:${upcomingInterview.kind}:${upcomingInterview.id}`,
      lead: interviewWhen ? `${capitalize(interviewWhen)}:` : 'Interview coming up:',
      text: `Prep for your ${upcomingInterview.title} interview`,
      href: topHref(withSrc(upcomingInterview.href)),
    })
  }
  for (const f of followUpRows) {
    if (f.kind !== 'needs-follow-up' || f.needsKind === 'interview') continue
    const age = daysSince(f.date)
    if (f.needsKind === 'meeting') {
      // A calendar "interview" is a keyword guess — only a thank-you for a job
      // we know about (the event names one of their companies) goes in Top 3.
      const title = f.subtitle.toLowerCase()
      const isJobInterview = appliedCompanies.some(
        (j) => j.companyName && j.companyName.length >= 3 && title.includes(j.companyName.toLowerCase())
      )
      if (f.meetingEventType === 'INTERVIEW' && !isJobInterview) continue
      candidatesForTop.push({
        key: `fu:${f.kind}:${f.id}`,
        lead: age !== null && age >= 2 ? 'Overdue:' : 'Today:',
        text: `Send ${f.title} a thank-you: ${f.subtitle.replace(/^Follow up after /, '')}`,
        href: topHref(withSrc(f.href)),
      })
    } else {
      candidatesForTop.push({
        key: `fu:${f.kind}:${f.id}`,
        lead: age !== null && age >= 4 ? `Waiting ${age} days:` : 'Reply today:',
        text: `${f.title} is waiting on you. ${f.subtitle.replace(/^Reply to /, '')}`,
        href: topHref(withSrc(f.href)),
      })
    }
  }
  if (reconnect) {
    candidatesForTop.push({
      key: reconnect.key,
      lead: 'Door just opened:',
      text: `Message ${reconnect.title}, ${reconnect.detail ?? 'a role there just opened'}`,
      href: topHref(withSrc(networkUrl)),
    })
  }
  for (const a of applications) {
    candidatesForTop.push({
      key: a.key,
      lead: 'Going cold:',
      text: `Follow up on ${a.title}${a.detail ? ` (${a.detail})` : ''}`,
      href: topHref(a.href ?? jobsUrl),
    })
  }
  if (todosForToday[0]) {
    candidatesForTop.push({
      key: 'todo:0',
      lead: `+${todosForToday[0].points} pts:`,
      text: todosForToday[0].text,
      href: topHref(withSrc('/dashboard')),
    })
  }
  const priorities = candidatesForTop.slice(0, MAX_PRIORITIES)
  const inPriorities = new Set(priorities.map((p) => p.key))
  // Nothing appears twice: what's in Top 3 leaves the lists below it.
  const applicationsListed = applications.filter((a) => !inPriorities.has(a.key))
  const applicationsShown = applicationsListed.slice(0, MAX_APPS_SHOWN)
  const networkingListed = networking.filter((n) => !inPriorities.has(n.key))
  const todosListed = todosForToday.filter((_, i) => !(i === 0 && inPriorities.has('todo:0')))
  const staleApplicationCount = await prisma.jobPosting.count({
    where: {
      candidateId: candidate.id,
      appliedAt: {
        not: null,
        lt: new Date(now.getTime() - APPLICATION_MAX_AGE_DAYS * DAY_MS),
      },
      declinedAt: null,
      interviewCompleteAt: null,
    },
  })

  // ── Rotations: unlock nudge, action button, quote ─────────────────────
  const recentlyShown = (prefix: string, days: number) => {
    const cutoff = now.getTime() - days * DAY_MS
    return new Set(
      shown
        .filter((s) => s.itemKey.startsWith(prefix) && s.shownAt.getTime() >= cutoff)
        .map((s) => s.itemKey.slice(prefix.length))
    )
  }
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const gmailConnected =
    (await prisma.emailConnection.count({
      where: { candidateId: candidate.id, disconnectedAt: null },
    })) > 0
  const ctx: RotationContext = {
    skillsAssessmentDone: !!candidate.skillsAssessmentCompletedAt,
    dossierUnlocked: dossier.unlocked,
    referencesMet: dossier.referencesMet,
    gmailConnected,
    recruiterDatabaseOptIn: candidate.recruiterDatabaseOptIn,
    trackedCompanyCount: watchlist.length,
    checkedInToday: !!candidate.lastCheckInAt && candidate.lastCheckInAt >= todayStart,
    hasOpenTodos: todosForToday.length > 0,
    topTodo: todosForToday[0]?.text ?? null,
    // Owed follow-ups only — counting every stale contact makes the button a chore.
    followUpCount: applications.length + repliesOwed.length + starred.length,
    newJobCount: jobItems.length,
  }
  const dateSeed = `${candidate.id}:${now.toISOString().slice(0, 10)}`
  const pickFrom = <T>(pool: T[], salt: string): T | null =>
    pool.length === 0 ? null : pool[Math.floor(seededRandom(`${dateSeed}:${salt}`)() * pool.length)]

  const recentUnlocks = recentlyShown('unlock:', UNLOCK_REPEAT_DAYS)
  const unlockPick = pickFrom(
    UNLOCK_NUDGES.filter((n) => !n.done?.(ctx) && !recentUnlocks.has(n.id)),
    'unlock'
  )
  const unlock: DailyItem | null = unlockPick
    ? {
        key: `unlock:${unlockPick.id}`,
        title: unlockPick.title,
        detail: unlockPick.detail,
        href: withSrc(unlockPick.path),
      }
    : null

  // Check-in leads whenever they haven't checked in today; otherwise the
  // button walks through the rest in order, one per day.
  const relevantButtons = ACTION_BUTTONS.filter((b) => b.relevant?.(ctx) ?? true)
  const dayIndex = Math.floor(now.getTime() / DAY_MS)
  const button = relevantButtons.find((b) => b.id === 'check-in') ?? relevantButtons[dayIndex % relevantButtons.length]
  const action = { label: button.label(ctx), href: withSrc(button.path) }

  const recentQuotes = recentlyShown('quote:', QUOTE_REPEAT_DAYS)
  const quote =
    pickFrom(
      QUOTES.filter((q) => !recentQuotes.has(q.id)),
      'quote'
    ) ?? pickFrom(QUOTES, 'quote')

  const dayNumber = candidate.registrationCompletedAt
    ? Math.floor((now.getTime() - candidate.registrationCompletedAt.getTime()) / DAY_MS) + 1
    : null

  const freshCount = jobItems.length + companyMoves.length + (reconnect ? 1 : 0) + (article ? 1 : 0)

  return {
    firstName: candidate.firstName,
    streak: candidate.currentStreak,
    dayNumber,
    score,
    priorities,
    todos: todosListed,
    applications: applicationsShown,
    applicationsMoreCount: applicationsListed.length - applicationsShown.length,
    staleApplicationCount,
    networking: networkingListed,
    networkingMoreCount,
    jobs: { items: jobItems, lockedCount },
    companyMoves,
    reconnect,
    article,
    unlock,
    action,
    quote,
    freshCount,
  }
}

// Every item key in the content — logged after a successful send so none of
// these ever show again. Follow-ups aren't logged: they're tasks that stay
// until done.
export function shownItemKeys(content: JobSearchDailyContent): string[] {
  return [
    ...content.jobs.items.map((i) => i.key),
    ...content.companyMoves.map((i) => i.key),
    ...[content.reconnect, content.article, content.unlock].filter((i): i is DailyItem => !!i).map((i) => i.key),
    ...(content.quote ? [`quote:${content.quote.id}`] : []),
  ]
}

// Keys that come back around after a repeat window (unlock nudge, quote) —
// their existing row's shownAt gets bumped on each showing so the window
// restarts.
export function rotatingItemKeys(content: JobSearchDailyContent): string[] {
  return [...(content.unlock ? [content.unlock.key] : []), ...(content.quote ? [`quote:${content.quote.id}`] : [])]
}

// Whether there's anything worth sending today: something new, or
// something to do.
export function hasSomethingToSay(content: JobSearchDailyContent): boolean {
  return (
    content.freshCount > 0 ||
    content.priorities.length > 0 ||
    content.staleApplicationCount > 0 ||
    content.todos.length > 0 ||
    content.applications.length > 0 ||
    content.networking.length > 0
  )
}

// Where this week's points stand against an even pace to an A by Sunday.
function scoreStatus(earned: number, target: number, now: Date): ScoreStatus {
  if (earned >= target) return 'locked'
  const expected = expectedPointsByToday(target, now)
  if (earned >= expected) return 'onTrack'
  return earned >= expected / 2 ? 'behind' : 'atRisk'
}

// Points a candidate "should" have by this point in the week to be on pace
// for an A — linear over Monday through Sunday.
function expectedPointsByToday(target: number, now: Date): number {
  const dayIndex = (now.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  return Math.round((target * (dayIndex + 1)) / 7)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// "today", "tomorrow", or the weekday — in Eastern time, which is where the
// email's 8am send is anchored.
function relativeDay(when: Date, now: Date): string {
  const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: DISPLAY_TZ })
  if (ymd(when) === ymd(now)) return 'today'
  if (ymd(when) === ymd(new Date(now.getTime() + DAY_MS))) return 'tomorrow'
  return when.toLocaleDateString('en-US', {
    weekday: 'long',
    timeZone: DISPLAY_TZ,
  })
}

function dedupeOrgNames(names: string[]): string[] {
  const out: string[] = []
  for (const name of names) {
    if (!out.some((n) => orgNamesMatch(n, name))) out.push(name)
  }
  return out
}

function warmthRank(warmth: string): number {
  return warmth === 'HOT' ? 2 : warmth === 'WARM' ? 1 : 0
}
