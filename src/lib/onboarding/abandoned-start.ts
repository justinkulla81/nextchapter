// The "pick up where you left off" emails for people who started onboarding, gave us an email and did not register.
//
// The nurture and lifecycle emails (src/lib/leads) cover people who filled in a form on the public site, and the older
// registration reminder (src/app/api/cron/registration-reminders) covers people who finished the old assessment. Someone who
// answered the first questions, left an email on the details step and closed the tab fell between all three (found
// 2026-11-05: 14 of 27 unregistered starters in 30 days had an email and 9 had never been emailed). Pure: abandoned-start.test.ts.

export type AbandonStep = 'finish_1' | 'finish_2'
export const ABANDON_STEPS: AbandonStep[] = ['finish_1', 'finish_2']

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** How long after the last activity each email becomes due, and how long it stays worth sending. */
export const STEP_TIMING: Record<AbandonStep, { afterMs: number; windowMs: number }> = {
  finish_1: { afterMs: 2 * HOUR_MS, windowMs: 3 * DAY_MS },
  finish_2: { afterMs: 3 * DAY_MS, windowMs: 7 * DAY_MS },
}

/** Someone who asked for the link ("email me a link to finish later") gets the first email right away. */
export const SAVED_FOR_LATER_AFTER_MS = 0

/** Never two emails from us closer together than this (lifecycle, nurture or this sequence). */
export const MIN_GAP_MS = 2 * DAY_MS

/** Only people who started this recently are ever considered. */
export const LOOKBACK_MS = 14 * DAY_MS

export const abandonedRef = (step: AbandonStep, email: string) => `onboarding:${step}:${email.trim().toLowerCase()}`
export const ABANDONED_REF_PREFIX = 'onboarding:'

/** Off until the owner turns it on: ABANDONED_START_EMAILS=1. Off, the pass reports counts and sends nothing. */
export function abandonedStartEmailsOn(): boolean {
  return process.env.ABANDONED_START_EMAILS === '1'
}

export interface DueInput {
  now: Date
  /** The profile's last change: a person still answering questions is not "gone". */
  lastActivityAt: Date
  /** Set when the visitor asked for the link; the first email is then due at once. */
  savedForLaterAt: Date | null
  /** Per step, when it was sent. */
  sent: Partial<Record<AbandonStep, Date>>
  /** The most recent email of any kind from us to this address. */
  lastAnyEmailAt: Date | null
}

/** The one email due now, or null. A step past its window is skipped, never sent late. */
export function dueAbandonedStep(i: DueInput): AbandonStep | null {
  const now = i.now.getTime()
  if (i.lastAnyEmailAt && now - i.lastAnyEmailAt.getTime() < MIN_GAP_MS && !(i.savedForLaterAt && !i.sent.finish_1)) return null

  if (!i.sent.finish_1) {
    const from = i.savedForLaterAt ? i.savedForLaterAt.getTime() + SAVED_FOR_LATER_AFTER_MS : i.lastActivityAt.getTime() + STEP_TIMING.finish_1.afterMs
    const window = i.savedForLaterAt ? 3 * DAY_MS : STEP_TIMING.finish_1.windowMs
    return now >= from && now <= from + window ? 'finish_1' : null
  }
  if (!i.sent.finish_2) {
    const from = i.sent.finish_1.getTime() + STEP_TIMING.finish_2.afterMs
    return now >= from && now <= from + STEP_TIMING.finish_2.windowMs ? 'finish_2' : null
  }
  return null
}

export interface AbandonedContent {
  subject: string
  headline: string
  paragraphs: string[]
  ctaLabel: string
}

/** What the person still has to do, in the words of the page they stopped on. */
export function abandonedContent(step: AbandonStep, firstName: string | null, stopLabel: string | null): AbandonedContent {
  const hello = firstName ? `Hi ${firstName},` : 'Hi,'
  const where = stopLabel ? `You stopped at “${stopLabel}”.` : 'You were part of the way through.'
  if (step === 'finish_1') {
    return {
      subject: 'Your answers are saved. Pick up where you left off',
      headline: 'Your answers are saved',
      paragraphs: [hello, `${where} Everything you have told us so far is saved, and the button below takes you straight back to that step.`, 'The rest takes a few minutes.'],
      ctaLabel: 'Continue where I left off',
    }
  }
  return {
    subject: 'Still want your Market Reality Assessment?',
    headline: 'Your Market Reality Assessment is waiting',
    paragraphs: [hello, `${where} Your place is still saved. The button below picks it up.`],
    ctaLabel: 'Finish my assessment',
  }
}

export function abandonedText(c: AbandonedContent, url: string): string {
  return [c.headline, '', ...c.paragraphs, '', `${c.ctaLabel}: ${url}`].join('\n')
}
