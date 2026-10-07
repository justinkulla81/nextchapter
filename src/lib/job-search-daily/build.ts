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
import { pickVicLine, seededRandom, LINE_REPEAT_DAYS, type LineMood } from './lines'
import {
  UNLOCK_NUDGES,
  UNLOCK_REPEAT_DAYS,
  ACTION_BUTTONS,
  QUOTES,
  QUOTE_REPEAT_DAYS,
  type RotationContext,
  type Quote,
} from './rotations'

// Job Search Daily — one short email a day, built from things that are
// actually new for this candidate since the last one. Every item shown is
// logged in JobSearchDailyItem and never shown again, which is the whole
// anti-repetition mechanism; sections with nothing new are dropped rather
// than padded. No LLM call anywhere in here (founder decision, 2026-10-07).

const DAY_MS = 24 * 60 * 60 * 1000
const QUIET_THRESHOLD_DAYS = 3
const MAX_TODOS = 3
const MAX_JOBS = 3
const JOB_LOOKBACK_DAYS = 7 // first send, or a candidate returning after a gap
const LAYOFF_LOOKBACK_DAYS = 3
const LAYOFF_MIN_EMPLOYEES = 200
const ARTICLE_LOOKBACK_DAYS = 21
const COMPANY_MOVE_MIN_DELTA = 3 // open roles up or down by at least this many over 4 weeks…
const COMPANY_MOVE_MIN_SHARE = 0.15 // …and by at least this share, so 594 → 580 at a giant isn't "news"

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

export interface JobSearchDailyContent {
  dayNumber: number | null
  line: { key: string; text: string }
  score: { earned: number; target: number } | null
  todos: DailyTodo[]
  jobs: { items: DailyItem[]; lockedCount: number }
  companyMoves: DailyItem[]
  layoff: DailyItem | null
  reconnect: DailyItem | null
  article: DailyItem | null
  followUps: DailyItem[] // every reply owed and unanswered application — tasks, not news, so never deduped
  stale: DailyItem[] // contacts not reached in a while (full list; the email shows the top few)
  starred: DailyItem[] // starred contacts due for outreach
  unlock: DailyItem | null
  action: { label: string; href: string }
  quote: Quote | null
  freshCount: number // new items beyond the line, todos and score — 0 means there's nothing new to say today
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
    return n === 0 ? null : n === 1 ? 'You know 1 person there.' : `You know ${n} people there.`
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
  const score = sprint ? { earned: engines.weeklyPoints, target: engines.weeklyPointsTarget } : null

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
    const [signals, warns] = await Promise.all([
      prisma.companySignal.findMany({
        where: { weekStartDate: weekStart },
        include: { company: { select: { id: true, name: true } } },
      }),
      prisma.warnNotice.findMany({
        where: {
          fetchedAt: { gte: new Date(now.getTime() - 14 * DAY_MS) },
          dismissedAt: null,
        },
        select: {
          id: true,
          employer: true,
          employees: true,
          state: true,
          noticeDate: true,
        },
      }),
    ])
    for (const name of trackedNames) {
      const warn = warns.find((w) => orgNamesMatch(w.employer, name) && !shownKeys.has(`warn:${w.id}`))
      if (warn) {
        companyMoves.push({
          key: `warn:${warn.id}`,
          title: `${name} filed a layoff notice`,
          detail: [
            warn.employees ? `${warn.employees} roles affected` : null,
            warn.state ? `in ${warn.state}` : null,
            'Worth a check before your next conversation there.',
          ]
            .filter(Boolean)
            .join(' '),
          href: null,
        })
        continue
      }
      const signal = signals.find((s) => orgNamesMatch(s.company.name, name))
      const key = signal ? `co:${signal.company.id}:${weekStart.toISOString().slice(0, 10)}` : null
      if (!signal || !key || shownKeys.has(key)) continue
      const before = signal.openRolesTotal - signal.rolesDelta4wk
      const delta = Math.abs(signal.rolesDelta4wk)
      if (delta < COMPANY_MOVE_MIN_DELTA || delta < Math.max(before, 1) * COMPANY_MOVE_MIN_SHARE) continue
      const up = signal.rolesDelta4wk > 0
      // The Company record's name, not however the candidate typed it.
      const display = signal.company.name
      companyMoves.push({
        key,
        title: up ? `${display} is hiring more` : `${display} is hiring less`,
        detail: [
          `Open roles ${up ? 'up' : 'down'} from ${before} to ${signal.openRolesTotal} in four weeks.`,
          knowLine(name),
        ]
          .filter(Boolean)
          .join(' '),
        href: jobsUrl,
      })
    }
  }

  // ── One layoff headline worth knowing about ───────────────────────────
  const layoffNews = await prisma.layoffNewsMention.findMany({
    where: {
      createdAt: {
        gte: new Date(now.getTime() - LAYOFF_LOOKBACK_DAYS * DAY_MS),
      },
      employees: { gte: LAYOFF_MIN_EMPLOYEES },
    },
    orderBy: { employees: 'desc' },
    take: 20,
  })
  // Only headlines tied to a US WARN filing (a notice with a state) — the
  // news feed also picks up overseas layoffs that mean nothing to a US search.
  const usNoticeIds = new Set(
    (
      await prisma.warnNotice.findMany({
        where: {
          id: { in: layoffNews.map((n) => n.noticeId).filter((id): id is string => !!id) },
          state: { not: null },
        },
        select: { id: true },
      })
    ).map((w) => w.id)
  )
  const layoffRow = layoffNews.find(
    (n) =>
      !!n.noticeId &&
      usNoticeIds.has(n.noticeId) &&
      !shownKeys.has(`layoff:${n.id}`) &&
      !companyMoves.some((m) => orgNamesMatch(m.title.split(' ')[0], n.company))
  )
  // No US headline today → fall back to a large US WARN filing itself.
  const warnRow = layoffRow
    ? null
    : (
        await prisma.warnNotice.findMany({
          where: {
            fetchedAt: { gte: new Date(now.getTime() - LAYOFF_LOOKBACK_DAYS * DAY_MS) },
            employees: { gte: LAYOFF_MIN_EMPLOYEES },
            state: { not: null },
            dismissedAt: null,
          },
          orderBy: { employees: 'desc' },
          take: 10,
          select: { id: true, employer: true, employees: true, state: true, sourceUrl: true },
        })
      ).find((w) => !shownKeys.has(`warn:${w.id}`) && !companyMoves.some((m) => m.key === `warn:${w.id}`))
  const layoffDetail = 'More people in the market means more competition, and more experienced people worth knowing.'
  const layoff: DailyItem | null = layoffRow
    ? {
        key: `layoff:${layoffRow.id}`,
        title: `${layoffRow.company} is cutting ${layoffRow.employees} roles`,
        detail: layoffDetail,
        href: layoffRow.url,
      }
    : warnRow
      ? {
          key: `warn:${warnRow.id}`,
          title: `${warnRow.employer} filed notice for ${warnRow.employees} layoffs in ${warnRow.state}`,
          detail: layoffDetail,
          href: warnRow.sourceUrl,
        }
      : null

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
        title: `Reach out to ${candidates[0].name}`,
        detail: `${candidates[0].name} is at ${company}, which ${
          fitCompanies.has(company) ? 'just posted a role that fits you' : 'is hiring more right now'
        }. A short note asking how the team is doing is enough.`,
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
          detail: articleRow.newsBlurb ?? articleRow.newsSource ?? null,
          href: digestClickUrl('candidate', candidate.id, articleRow.id),
        }
      : null

  // ── Follow-ups and starred people ─────────────────────────────────────
  const withSrc = (href: string) =>
    href.startsWith('http') ? href : `${appUrl}${href}${href.includes('?') ? '&' : '?'}src=job_search_daily`
  const followUpRows = await getUnifiedFollowUps(candidate.id, 50)
  const toItem = (f: (typeof followUpRows)[number]): DailyItem => ({
    key: `fu:${f.kind}:${f.id}`,
    title: f.title,
    detail: f.subtitle,
    href: withSrc(f.href),
  })
  const followUps = followUpRows
    .filter((f) => f.kind === 'needs-follow-up' || f.kind === 'unanswered-application')
    .map(toItem)
  // Synced contacts include automated senders ("LinkedIn Job Alerts") —
  // never tell someone to reconnect with a mailing list.
  const stale = followUpRows
    .filter((f) => f.kind === 'stale-contact' && !/\b(alerts?|no-?reply|notifications?|newsletter)\b/i.test(f.title))
    .map(toItem)
  const starred = followUpRows
    .filter((f) => f.kind === 'starred-contact')
    .map((f) => ({ ...toItem(f), detail: f.subtitle.replace(/^Starred — /, '') || null }))

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
    (await prisma.emailConnection.count({ where: { candidateId: candidate.id, disconnectedAt: null } })) > 0
  const ctx: RotationContext = {
    skillsAssessmentDone: !!candidate.skillsAssessmentCompletedAt,
    dossierUnlocked: dossier.unlocked,
    referencesMet: dossier.referencesMet,
    gmailConnected,
    recruiterDatabaseOptIn: candidate.recruiterDatabaseOptIn,
    trackedCompanyCount: watchlist.length,
    checkedInToday: !!candidate.lastCheckInAt && candidate.lastCheckInAt >= todayStart,
    hasOpenTodos: todos.length > 0,
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
  const action = { label: button.label, href: withSrc(button.path) }

  const recentQuotes = recentlyShown('quote:', QUOTE_REPEAT_DAYS)
  const quote =
    pickFrom(
      QUOTES.filter((q) => !recentQuotes.has(q.id)),
      'quote'
    ) ?? pickFrom(QUOTES, 'quote')

  // ── Vic's line ────────────────────────────────────────────────────────
  const daysQuiet = candidate.lastCheckInAt ? (now.getTime() - candidate.lastCheckInAt.getTime()) / DAY_MS : Infinity
  const moods: LineMood[] = []
  if (daysQuiet >= QUIET_THRESHOLD_DAYS && candidate.lastCheckInAt) moods.push('quiet')
  else if (weekNumber <= 1) moods.push('firstWeek')
  else if (score && score.earned >= score.target) moods.push('ahead')
  else if (score && score.earned >= expectedPointsByToday(score.target, now)) moods.push('onPace')
  else if (score) moods.push('behind')
  const weekday = now.getUTCDay()
  if (weekday === 1) moods.push('monday')
  if (weekday === 5) moods.push('friday')
  const lineCutoff = now.getTime() - LINE_REPEAT_DAYS * DAY_MS
  const recentLineIds = new Set(
    shown
      .filter((s) => s.itemKey.startsWith('line:') && s.shownAt.getTime() >= lineCutoff)
      .map((s) => s.itemKey.slice(5))
  )
  const vicLine = pickVicLine(moods, recentLineIds, `${candidate.id}:${now.toISOString().slice(0, 10)}`)

  const dayNumber = candidate.registrationCompletedAt
    ? Math.floor((now.getTime() - candidate.registrationCompletedAt.getTime()) / DAY_MS) + 1
    : null

  const freshCount = jobItems.length + companyMoves.length + (layoff ? 1 : 0) + (reconnect ? 1 : 0) + (article ? 1 : 0)

  return {
    dayNumber,
    line: { key: `line:${vicLine.id}`, text: vicLine.text },
    score,
    todos,
    jobs: { items: jobItems, lockedCount },
    companyMoves,
    layoff,
    reconnect,
    article,
    followUps,
    stale,
    starred,
    unlock,
    action,
    quote,
    freshCount,
  }
}

// Every item key in the content — logged after a successful send so none of
// these ever show again.
export function shownItemKeys(content: JobSearchDailyContent): string[] {
  return [
    content.line.key,
    ...content.jobs.items.map((i) => i.key),
    ...content.companyMoves.map((i) => i.key),
    ...[content.layoff, content.reconnect, content.article, content.unlock]
      .filter((i): i is DailyItem => !!i)
      .map((i) => i.key),
    ...(content.quote ? [`quote:${content.quote.id}`] : []),
  ]
}

// Keys that come back around after a repeat window (line, unlock nudge,
// quote) — their existing row's shownAt gets bumped on each showing so the
// window restarts.
export function rotatingItemKeys(content: JobSearchDailyContent): string[] {
  return [
    content.line.key,
    ...(content.unlock ? [content.unlock.key] : []),
    ...(content.quote ? [`quote:${content.quote.id}`] : []),
  ]
}

// Whether there's anything worth sending today: something new, or
// something to do.
export function hasSomethingToSay(content: JobSearchDailyContent): boolean {
  return (
    content.freshCount > 0 ||
    content.todos.length > 0 ||
    content.followUps.length > 0 ||
    content.starred.length > 0 ||
    content.stale.length > 0
  )
}

// Points a candidate "should" have by this point in the week to be on pace
// for an A — linear over Monday through Sunday.
function expectedPointsByToday(target: number, now: Date): number {
  const dayIndex = (now.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  return Math.round((target * (dayIndex + 1)) / 7)
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
