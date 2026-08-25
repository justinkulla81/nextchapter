import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVictoriaName } from '@/lib/victoria'
import { isSearchStrategyGateComplete } from '@/lib/dashboard/access-gate'
import { isLinkedInConnected } from '@/lib/dashboard/linkedin-connection'
import { getProfileChecklistItems } from '@/lib/weekly/profile-checklist'
import Week1KickoffEmail from '@/emails/week1-kickoff'

// Same 4 profile-confirm types SuccessSprintCard.tsx's own Priority gate
// checks — kept as a local literal rather than importing that component's
// private constant, same as the rest of this gate's checks below mirror
// (not reuse directly) SuccessSprintCard's bothConnectedUnlocked.
const PROFILE_UNLOCK_TYPES = ['PROFILE_CONFIRM', 'INDUSTRY_CONFIRM', 'FUNCTION_CONFIRM', 'SALARY_CONFIRM'] as const

// Matches SuccessSprintCard.tsx's own FIXED_PRIORITY_RANK top 3 exactly —
// the real, current-week actions worth doing once onboarding is done.
const PRIORITY_ACTIONS = ['Fix your Resume Issues', 'Apply to Full-Time Jobs', 'Get Networking']

// Victoria's Day 2 kickoff — one-time onboarding email, the first full day
// after registration. Independent of the weekly email cadence (it isn't
// gated by day-of-week or notification tier beyond MINIMAL exclusion, both
// applied by the caller's eligibility query) — extracted to its own sender/
// cron so it can't be crowded out by the 7-day dispatcher schedule.
//
// The action list is gate-aware: recommending "Post on LinkedIn" or a
// Priority action to a candidate who hasn't even connected Gmail/Calendar
// or LinkedIn yet, or hasn't finished Search Strategy, pointed them at
// exactly the same actions the dashboard's own Priority section keeps
// locked (see SuccessSprintCard.tsx's bothConnectedUnlocked) — a real
// mismatch between what this email told them to do and what the dashboard
// would actually let them do. Recommends the 3 outstanding onboarding
// steps first; only once all three are done does it recommend Priority
// actions instead.
export async function sendWeek1Kickoff(candidateId: string) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping Week 1 kickoff email.')
    return { sent: false as const }
  }

  try {
    const [candidateRow, emailConnection, calendarConnection, linkedInConnection, profileChecklistItems] =
      await Promise.all([
        prisma.candidateProfile.findUniqueOrThrow({ where: { id: candidateId } }),
        prisma.emailConnection.findFirst({ where: { candidateId, disconnectedAt: null } }),
        prisma.calendarConnection.findFirst({ where: { candidateId, disconnectedAt: null } }),
        prisma.linkedInConnection.findUnique({ where: { candidateId } }),
        getProfileChecklistItems(candidateId),
      ])
    const candidate = { ...candidateRow, linkedInConnection }

    const admin = createAdminClient()
    const { data: userData } = await admin.auth.admin.getUserById(candidate.userId)
    const email = userData.user?.email
    if (!email) return { sent: false as const }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const unsubscribeUrl = `${appUrl}/api/unsubscribe/${candidate.id}?type=daily`

    const connectionsUnlocked = !!emailConnection && !!calendarConnection && isLinkedInConnected(candidate)
    const profileComplete = PROFILE_UNLOCK_TYPES.every(
      (type) => profileChecklistItems.find((item) => item.actionType === type)?.complete
    )
    const searchStrategyComplete = isSearchStrategyGateComplete(candidate)
    const onboardingComplete = connectionsUnlocked && profileComplete && searchStrategyComplete

    const actionItems = onboardingComplete
      ? PRIORITY_ACTIONS
      : [
          !(!!emailConnection && !!calendarConnection) && 'Connect Gmail and Calendar',
          !isLinkedInConnected(candidate) && 'Connect LinkedIn',
          !(profileComplete && searchStrategyComplete) && 'Complete your Profile and Search Strategy',
        ].filter((v): v is string => !!v)

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error } = await resend.emails.send({
      from: 'NextChapter <support@launchyournextchapter.com>',
      replyTo: 'support@launchyournextchapter.com',
      to: email,
      subject: candidate.firstName
        ? `Your Day 2 action plan is ready, ${candidate.firstName}`
        : 'Your Day 2 action plan is ready',
      react: Week1KickoffEmail({
        firstName: candidate.firstName,
        victoriaName: getVictoriaName('introduction'),
        onboardingComplete,
        actionItems,
        appUrl,
        unsubscribeUrl,
      }),
    })

    if (error) {
      console.error('Failed to send Week 1 kickoff email:', error)
      return { sent: false as const }
    }

    await prisma.candidateProfile.update({ where: { id: candidateId }, data: { lastDailyEmailSentAt: new Date() } })
    return { sent: true as const }
  } catch (error) {
    console.error('Failed to send Week 1 kickoff email:', error)
    return { sent: false as const }
  }
}
