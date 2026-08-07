import 'server-only'
import type { AdminNudgeType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getCurrentWeekSprint, getCandidateWeekNumber, getMondayOfWeek } from '@/lib/weekly/sprint'
import { pointsNeededForA } from '@/lib/weekly/action-effort'
import { normalizeGradeSnapshot } from '@/lib/scoring/hireability-grade'
import { PRIVACY_TIERS } from '@/lib/constants/privacy'
import { NOTIFICATION_TIERS } from '@/lib/constants/notifications'

export const NUDGE_TYPES: { value: AdminNudgeType; label: string }[] = [
  { value: 'WEEKLY_TARGET', label: 'Complete weekly target' },
  { value: 'NETWORKING', label: 'Network more' },
  { value: 'LEARNING', label: 'Learn a new skill' },
  { value: 'INTERIM_JOB', label: 'Find an interim job' },
  { value: 'CONNECT_GMAIL', label: 'Connect Gmail' },
  { value: 'UPDATE_PROFILE', label: 'Update profile' },
  { value: 'COMMUNITY', label: 'Engage in NC Support Network' },
  { value: 'RECRUITER_HELP', label: 'Consider recruiter/coach help' },
  { value: 'UPDATE_PRIVACY', label: 'Review privacy settings' },
]

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export interface NudgeDraft {
  subject: string
  body: string
  ctaLabel: string
  ctaUrl: string
}

// A candidate can be nudged before they've committed to a first Search
// Sprint at all (weekNumber/pointsTarget still resolve — see
// getCandidateWeekNumber/pointsNeededForA — they just describe week 1).
async function buildWeeklyTargetDraft(candidateId: string, firstName: string): Promise<NudgeDraft> {
  const weekStart = getMondayOfWeek(new Date())
  const [weekNumber, sprint] = await Promise.all([
    getCandidateWeekNumber(candidateId, weekStart),
    getCurrentWeekSprint(candidateId),
  ])
  const pointsTarget = pointsNeededForA(weekNumber)
  const committed = (sprint?.committedActions as unknown as { completed: boolean; points: number }[]) ?? []
  const pointsEarned = committed.filter((a) => a.completed).reduce((sum, a) => sum + a.points, 0)
  const completedCount = committed.filter((a) => a.completed).length
  const totalCount = committed.length

  const statusLine = sprint
    ? `Right now you're at ${pointsEarned} of ${pointsTarget} points for this week's target (${completedCount} of ${totalCount} committed actions done).`
    : `You haven't committed to this week's Search Sprint yet, so you're at 0 of ${pointsTarget} points toward this week's target.`

  const body = [
    `Hi ${firstName},`,
    `${statusLine}`,
    `Weekly momentum is the single biggest driver of a real A this month — candidates who get ahead of their target early in the week tend to stay ahead through Sunday, and it's the clearest signal we can show a hiring manager that you're actually running a search, not just building a profile.`,
    `Take a few minutes today to knock out one or two of this week's committed actions.`,
  ].join('\n\n')

  return {
    subject: `${firstName}, a quick nudge on this week's target`,
    body,
    ctaLabel: 'Go to your Success Dashboard',
    ctaUrl: `${APP_URL}/dashboard`,
  }
}

async function buildNetworkingDraft(candidateId: string, firstName: string): Promise<NudgeDraft> {
  const [contactCount, warmCount, outreachCount7d] = await Promise.all([
    prisma.supportNetworkContact.count({ where: { candidateId } }),
    prisma.supportNetworkContact.count({ where: { candidateId, warmth: { in: ['HOT', 'WARM'] } } }),
    prisma.outreachLog.count({
      where: { candidateId, loggedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ])

  const statusLine =
    contactCount === 0
      ? `You haven't added anyone to your contact list yet.`
      : `You have ${contactCount} contact${contactCount === 1 ? '' : 's'} in your list (${warmCount} marked warm or hot), and ${outreachCount7d} outreach message${outreachCount7d === 1 ? '' : 's'} logged in the last 7 days.`

  const body = [
    `Hi ${firstName},`,
    statusLine,
    `Networking is still the single highest-leverage thing you can do in a search — most roles get filled through a connection, not a cold application, and the people most likely to help you probably aren't your closest friends. They're the people you sort of know.`,
    `Pick one or two people from your list and send a short note today — even a "just checking in" message counts.`,
  ].join('\n\n')

  return {
    subject: `${firstName}, one conversation could move things forward`,
    body,
    ctaLabel: 'Go to Live Conversations',
    ctaUrl: `${APP_URL}/dashboard/network`,
  }
}

async function buildLearningDraft(candidateId: string, firstName: string): Promise<NudgeDraft> {
  const learningBadgeCount = await prisma.learningBadge.count({ where: { candidateId } })

  const statusLine =
    learningBadgeCount === 0
      ? `You haven't logged any learning activity yet.`
      : `You've logged ${learningBadgeCount} learning badge${learningBadgeCount === 1 ? '' : 's'} so far.`

  const body = [
    `Hi ${firstName},`,
    statusLine,
    `A visible new skill or a real AI-fluency credential keeps your background current and gives recruiters something concrete to point to beyond your resume — it's a fast, low-cost way to stay competitive while you search.`,
    `Take a look at what's recommended for your background and log anything you've already been working on.`,
  ].join('\n\n')

  return {
    subject: `${firstName}, a quick way to stay sharp this week`,
    body,
    ctaLabel: 'Go to Learn New Skills',
    ctaUrl: `${APP_URL}/dashboard/learning`,
  }
}

async function buildInterimJobDraft(candidateId: string, firstName: string): Promise<NudgeDraft> {
  const profile = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { gigDirectoryUnlockAnswer: true, interimOutreachStartedAt: true },
  })
  const interimHistoryCount = await prisma.workHistoryEntry.count({
    where: { candidateId, engagementType: { in: ['INTERIM', 'FRACTIONAL', 'CONSULTING'] } },
  })

  const statusLine = interimHistoryCount > 0
    ? `You've already logged ${interimHistoryCount} interim/fractional/consulting engagement${interimHistoryCount === 1 ? '' : 's'} — nice work keeping that current.`
    : profile.interimOutreachStartedAt
      ? `You've started reaching out about interim work, but haven't logged a landed engagement yet.`
      : profile.gigDirectoryUnlockAnswer
        ? `You've set a target rate for interim work but haven't started outreach yet.`
        : `You haven't looked at interim or fractional work yet.`

  const body = [
    `Hi ${firstName},`,
    statusLine,
    `An interim, fractional, or consulting role fills the resume gap, gives you bridge income, and keeps you engaged and sharp while your full-time search continues — it's one of the fastest ways to stay in market shape between roles.`,
    `Take a look at the marketplaces and consulting setup steps whenever you have 15 minutes.`,
  ].join('\n\n')

  return {
    subject: `${firstName}, worth a look: interim and fractional work`,
    body,
    ctaLabel: 'Go to Find Interim Work',
    ctaUrl: `${APP_URL}/dashboard/interim-work`,
  }
}

async function buildConnectGmailDraft(candidateId: string, firstName: string): Promise<NudgeDraft> {
  const connection = await prisma.emailConnection.findUnique({
    where: { candidateId },
    select: { disconnectedAt: true, needsReconnectAt: true },
  })

  const statusLine = !connection || connection.disconnectedAt
    ? `You haven't connected Gmail yet.`
    : connection.needsReconnectAt
      ? `Your Gmail connection expired and needs to be reconnected.`
      : `Your Gmail is connected and syncing.`

  const body = [
    `Hi ${firstName},`,
    statusLine,
    `Connecting Gmail lets NextChapter automatically detect applications, interviews, and networking messages you've already sent — so real activity counts toward your grade without you having to log every email by hand.`,
    `It's read-only: NextChapter can never send, modify, or delete anything in your mailbox.`,
  ].join('\n\n')

  return {
    subject: `${firstName}, skip the manual logging — connect Gmail`,
    body,
    ctaLabel: 'Go to Live Conversations',
    ctaUrl: `${APP_URL}/dashboard/network`,
  }
}

async function buildUpdateProfileDraft(candidateId: string, firstName: string): Promise<NudgeDraft> {
  const profile = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: {
      profileConfirmedAt: true,
      industryConfirmedAt: true,
      functionConfirmedAt: true,
      salaryConfirmedAt: true,
      workAuthConfirmedAt: true,
      linkedInConfirmedAt: true,
    },
  })
  const checks: { label: string; done: boolean }[] = [
    { label: 'basics', done: !!profile.profileConfirmedAt },
    { label: 'industry', done: !!profile.industryConfirmedAt },
    { label: 'function', done: !!profile.functionConfirmedAt },
    { label: 'salary', done: !!profile.salaryConfirmedAt },
    { label: 'work authorization', done: !!profile.workAuthConfirmedAt },
    { label: 'LinkedIn URL', done: !!profile.linkedInConfirmedAt },
  ]
  const missing = checks.filter((c) => !c.done).map((c) => c.label)

  const statusLine = missing.length === 0
    ? `Every profile confirmation is up to date — nice.`
    : `${missing.length} of ${checks.length} profile confirmations are still outstanding: ${missing.join(', ')}.`

  const body = [
    `Hi ${firstName},`,
    statusLine,
    `An accurate, confirmed profile is what personalizes which jobs and skills get matched to you and feeds directly into your Market Reality Grade — an outdated one quietly costs you both without you noticing.`,
    `It only takes a couple of minutes to confirm what's left.`,
  ].join('\n\n')

  return {
    subject: `${firstName}, a couple of profile items left to confirm`,
    body,
    ctaLabel: 'Go to My Profile',
    ctaUrl: `${APP_URL}/dashboard/profile`,
  }
}

async function buildCommunityDraft(candidateId: string, firstName: string): Promise<NudgeDraft> {
  const [postCount, encouragementSentCount] = await Promise.all([
    prisma.communityPost.count({ where: { candidateId, isActive: true } }),
    prisma.encouragementNote.count({ where: { fromCandidateId: candidateId } }),
  ])

  const statusLine = postCount === 0 && encouragementSentCount === 0
    ? `You haven't posted or sent encouragement in the NC Support Network yet.`
    : `You've posted ${postCount} time${postCount === 1 ? '' : 's'} and sent ${encouragementSentCount} encouragement note${encouragementSentCount === 1 ? '' : 's'} to other candidates.`

  const body = [
    `Hi ${firstName},`,
    statusLine,
    `The NC Support Network is there for accountability and momentum, not just a leaderboard — candidates who engage regularly report staying more consistent week to week, especially on the weeks that are harder to stay motivated through.`,
    `Drop in, see what others are working on, and share where you're at.`,
  ].join('\n\n')

  return {
    subject: `${firstName}, your search doesn't have to be a solo effort`,
    body,
    ctaLabel: 'Go to NC Support Network',
    ctaUrl: `${APP_URL}/dashboard/community`,
  }
}

async function buildRecruiterHelpDraft(candidateId: string, firstName: string): Promise<NudgeDraft> {
  const [profile, latestReport] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: { recruiterDatabaseOptIn: true, coachId: true },
    }),
    prisma.hireabilityReport.findFirst({
      where: { candidateId },
      orderBy: { generatedAt: 'desc' },
      select: { hireabilityGradeAtGeneration: true },
    }),
  ])
  const grade = latestReport ? normalizeGradeSnapshot(latestReport.hireabilityGradeAtGeneration)?.grade : null

  const statusLine = [
    grade ? `You're currently graded ${grade}.` : `You don't have a graded report yet.`,
    profile.recruiterDatabaseOptIn
      ? `You've already opted into the Recruiter Database.`
      : `You haven't opted into the Recruiter Database yet, so recruiters can't discover you there.`,
    profile.coachId ? `You already have a coach assigned.` : `You don't have a coach assigned yet.`,
  ].join(' ')

  const body = [
    `Hi ${firstName},`,
    statusLine,
    `Getting in front of real recruiters — whether through the Recruiter Database or a working session with an Executive Coach — significantly increases your odds of landing interviews, especially once your profile and grade are in good shape.`,
    `Worth a look either way: opting into recruiter visibility costs you nothing, and a coach can help you close specific gaps faster than searching alone.`,
  ].join('\n\n')

  return {
    subject: `${firstName}, have you considered recruiter or coach help?`,
    body,
    ctaLabel: 'Go to Privacy Settings',
    ctaUrl: `${APP_URL}/dashboard/privacy`,
  }
}

async function buildUpdatePrivacyDraft(candidateId: string, firstName: string): Promise<NudgeDraft> {
  const profile = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { privacyTier: true, notificationTier: true },
  })
  const tierInfo = PRIVACY_TIERS.find((t) => t.value === profile.privacyTier)
  const notificationInfo = NOTIFICATION_TIERS.find((t) => t.value === profile.notificationTier)

  const statusLine = `Your privacy tier is currently "${tierInfo?.label ?? profile.privacyTier}" (${tierInfo?.description ?? ''}) and your notification setting is "${notificationInfo?.label ?? profile.notificationTier}".`

  const body = [
    `Hi ${firstName},`,
    statusLine,
    `A more locked-down privacy tier means fewer employers can see your profile at all, even when your background is a strong match — it's worth revisiting whenever your comfort level with visibility changes, not just once at signup.`,
    `Take two minutes to make sure your current settings actually reflect how visible you want to be right now.`,
  ].join('\n\n')

  return {
    subject: `${firstName}, quick check on your privacy settings`,
    body,
    ctaLabel: 'Go to Privacy Settings',
    ctaUrl: `${APP_URL}/dashboard/privacy`,
  }
}

export async function buildNudgeDraft(candidateId: string, nudgeType: AdminNudgeType): Promise<NudgeDraft> {
  const profile = await prisma.candidateProfile.findUniqueOrThrow({
    where: { id: candidateId },
    select: { firstName: true },
  })
  const firstName = profile.firstName || 'there'

  switch (nudgeType) {
    case 'WEEKLY_TARGET':
      return buildWeeklyTargetDraft(candidateId, firstName)
    case 'NETWORKING':
      return buildNetworkingDraft(candidateId, firstName)
    case 'LEARNING':
      return buildLearningDraft(candidateId, firstName)
    case 'INTERIM_JOB':
      return buildInterimJobDraft(candidateId, firstName)
    case 'CONNECT_GMAIL':
      return buildConnectGmailDraft(candidateId, firstName)
    case 'UPDATE_PROFILE':
      return buildUpdateProfileDraft(candidateId, firstName)
    case 'COMMUNITY':
      return buildCommunityDraft(candidateId, firstName)
    case 'RECRUITER_HELP':
      return buildRecruiterHelpDraft(candidateId, firstName)
    case 'UPDATE_PRIVACY':
      return buildUpdatePrivacyDraft(candidateId, firstName)
  }
}
