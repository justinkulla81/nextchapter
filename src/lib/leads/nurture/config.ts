// The follow-up sequence for people who gave us an email and have not become members: three short emails over two weeks,
// each with one job, then we stop. It is the value-first companion to the lifecycle emails (src/lib/leads/lifecycle), which
// ask for a profile and cover saved jobs, job alerts, the newsletter and the waitlists. An address belongs to one system:
// anyone the lifecycle emails cover is left to them (see run.ts), so nobody gets both.
//
// Day 0 is the email each capture already sends (the first-week plan, the deadline or alert confirmation, the pay check
// result, the guide). The three below count from it.

export type NurtureStep = 'next_step' | 'data_point' | 'assessment'
export const NURTURE_STEPS: NurtureStep[] = ['next_step', 'data_point', 'assessment']

/** Days after day 0 that each step becomes due. */
export const STEP_DAY: Record<NurtureStep, number> = { next_step: 3, data_point: 7, assessment: 14 }

/**
 * A step goes out only while it is this fresh. A step that is late by more than this is skipped, so switching the emails
 * on (or a day the cap ran out) never sends a three-week-old "day 3" note.
 */
export const STEP_WINDOW_DAYS = 4

/** Never two emails from us (lifecycle or this sequence) closer together than this. */
export const MIN_GAP_DAYS = 2

/** Most sends in one run; the daily cap is the real limit. */
export const MAX_SENDS_PER_RUN = 50

export const DEFAULT_DAILY_CAP = 20

/** Only leads from the last 30 days are ever considered (day 14 plus its window, with room). */
export const LOOKBACK_DAYS = 30

/** Off until the owner says so: set NURTURE_EMAILS=1. Off, the cron is a dry run that sends nothing. The owner turned it on in production on 2026-10-30. */
export function nurtureEmailsOn(): boolean {
  return process.env.NURTURE_EMAILS === '1'
}

/** Its own daily limit, apart from the shared Resend volume the alerts and digests use. */
export function nurtureDailyCap(): number {
  const n = Number(process.env.NURTURE_DAILY_CAP)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_DAILY_CAP
}

/** The CRM activity key that records a send: its unique (type, sourceRef) means one step goes to one address once. */
export const nurtureRef = (step: NurtureStep, email: string) => `nurture:${step}:${email.trim().toLowerCase()}`
export const NURTURE_REF_PREFIX = 'nurture:'
