// Review-cycle email content and eligibility. Pure: the sender and the cron
// both read this, and the tests pin the wording rules (neutral subjects,
// nothing that names an employer, no search-identifying terms).

import type { OutreachKind, ReviewCycle } from './review-schedule'

export type ReviewEmailInput = {
  kind: OutreachKind
  cycle: ReviewCycle
  firstName: string | null
  winCount: number
  openFollowUps: number
}

export type ReviewEmailContent = {
  subject: string
  heading: string
  intro: string
  steps: string[]
  ctaLabel: string
  ctaQuery: string // appended to /dashboard/in-work
  secondaryLabel?: string
  secondaryQuery?: string
}

function query(tab: string, kind: OutreachKind, cycleKey: string): string {
  return `?tab=${tab}&src=inwork_email&kind=${kind.toLowerCase()}&cycle=${cycleKey}`
}

export function buildReviewEmailContent(i: ReviewEmailInput): ReviewEmailContent {
  if (i.kind === 'PREPARE') {
    const wins =
      i.winCount > 0
        ? `Log anything missing since your last review. You have ${i.winCount} win${i.winCount === 1 ? '' : 's'} logged so far.`
        : 'Log your wins since your last review, each with a number. You have none logged yet.'
    return {
      subject: i.cycle.exact ? 'Your review is coming up: a 20-minute prep' : 'Review season is coming: a 20-minute prep',
      heading: 'Get ready for your review',
      intro: i.cycle.exact
        ? 'Your review is about three weeks away. Twenty minutes now means you walk in with your results, your ask and your questions.'
        : 'Reviews usually land around this time of year. Twenty minutes now means you walk in with your results, your ask and your questions.',
      steps: [
        wins,
        'Read your one-page impact summary and cut it to the top five results.',
        'Decide your ask, and check the market range for your role before you set a number.',
      ],
      ctaLabel: 'Start your prep',
      ctaQuery: query('prep', 'PREPARE', i.cycle.key),
      secondaryLabel: 'Log a win',
      secondaryQuery: query('impact', 'PREPARE', i.cycle.key),
    }
  }
  return {
    subject: 'How did your review go?',
    heading: 'How did it go?',
    intro:
      'Your review window has passed. Take five minutes while it is fresh. What you record now is where your next prep starts.',
    steps: [
      'Log the outcome: your rating, any raise, any promotion.',
      'Write down the feedback you received, in their words.',
      i.openFollowUps > 0
        ? `Check off the ${i.openFollowUps} follow-up${i.openFollowUps === 1 ? '' : 's'} from last time that are done.`
        : 'Record what was agreed, so you can hold both sides to it.',
    ],
    ctaLabel: 'Log how it went',
    ctaQuery: query('outcome', 'RESPOND', i.cycle.key),
    secondaryLabel: 'Log feedback',
    secondaryQuery: query('feedback', 'RESPOND', i.cycle.key),
  }
}
