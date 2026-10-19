import type { JourneyType } from '@prisma/client'

// Win-back for members who have gone quiet: up to three emails, then stop.
// "Quiet" is no login and no page activity; the steps land at 21, 42 and 63
// days since the last activity. Returning to the product resets the count,
// because the sends are counted since the last activity.
export const WIN_BACK_AFTER_DAYS = [21, 42, 63] as const

const DAY = 86_400_000

/** Minimum days between win-back emails, so catching up on several overdue steps never sends them back to back. */
export const WIN_BACK_MIN_GAP_DAYS = 14

export function winBackSpacedOut(lastSentAt: Date | null, now: Date): boolean {
  return !lastSentAt || now.getTime() - lastSentAt.getTime() >= WIN_BACK_MIN_GAP_DAYS * DAY
}

export type WinBackStep = 1 | 2 | 3

export function daysQuiet(lastActivity: Date, now: Date): number {
  return Math.floor((now.getTime() - lastActivity.getTime()) / DAY)
}

// The step due now, or null. `sentSinceActivity` counts WIN_BACK sends after
// the last activity, so each step goes out once and in order.
export function nextWinBackStep(lastActivity: Date, sentSinceActivity: number, now: Date): WinBackStep | null {
  if (sentSinceActivity >= WIN_BACK_AFTER_DAYS.length) return null
  const quiet = daysQuiet(lastActivity, now)
  return quiet >= WIN_BACK_AFTER_DAYS[sentSinceActivity] ? ((sentSinceActivity + 1) as WinBackStep) : null
}

// One small, specific thing for the first screen they see, by journey.
const ONE_THING: Partial<Record<JourneyType, string>> = {
  LAID_OFF: 'Log one application or one conversation. That is enough to restart your week.',
  EXPLORING_MOVE: 'Pick one role you would actually take a call about and save it.',
  GROWING: 'Write down one win from the last month. It is the start of your case at review time.',
  PROMOTION: 'Write down one win from the last month. It is the start of your case for the next level.',
  CAREER_CHANGE: 'Name one person in the field you want to enter, and send them a short note.',
  STUDENT_NEW_GRAD: 'Save one entry-level role you would be proud to get.',
  RETURNING: 'Update the one line on your resume that explains your time away.',
  NEXT_ACT: 'Write down one thing you want more of in your next chapter.',
  TIME_OFF: 'Check your return date. Your plan adjusts when it changes.',
  FRACTIONAL: 'Tell us how many open days you have. We match your plan to them.',
  ENTREPRENEUR: 'Write down one thing you learned this month. We will check in on it.',
}

export type WinBackContent = { subject: string; heading: string; body: string[]; cta: string; closing: string | null }

export function winBackContent(step: WinBackStep, firstName: string | null, journey: JourneyType): WinBackContent {
  const name = firstName ? `, ${firstName}` : ''
  const oneThing = ONE_THING[journey] ?? 'Open your plan and do the first item on it.'
  if (step === 1) {
    return {
      subject: `Your plan is waiting${name}`,
      heading: `Your plan is still here${name}`,
      body: ['It has been a few weeks. Nothing is lost, and your plan has kept up with where you said you are.', `One thing for today: ${oneThing}`],
      cta: 'Open your plan',
      closing: null,
    }
  }
  if (step === 2) {
    return {
      subject: 'Has anything changed?',
      heading: `Has anything changed${name}?`,
      body: ['Life moves. A new job, a break, a layoff, or a busy stretch all change what is useful from us.', 'Tell us where you are now and your plan and our emails follow it.', `If you only have a minute: ${oneThing}`],
      cta: 'Update where I am',
      closing: null,
    }
  }
  return {
    subject: 'Keep these emails or pause them?',
    heading: `Should we keep in touch${name}?`,
    body: ['This is our last note unless you come back. We would rather be useful than noisy.', 'Your profile and plan stay saved. Come back whenever you want, and pick up where you left off.'],
    cta: 'Keep my plan going',
    closing: 'Prefer quiet? Turn off these emails below and we will stop.',
  }
}
