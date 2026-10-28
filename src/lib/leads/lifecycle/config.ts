// Follow-up emails to people who gave us an address on the public site: a
// welcome that asks them to make a free profile, then a couple of reminders
// until they do (or unsubscribe). See run.ts for who gets what and when.

export type LeadVariant = 'saved_job' | 'job_alert' | 'newsletter' | 'waitlist' | 'waitlist_b2b'
export type LeadStep = 'welcome' | 'nudge1' | 'nudge2'

export const LEAD_VARIANTS: LeadVariant[] = ['saved_job', 'job_alert', 'newsletter', 'waitlist', 'waitlist_b2b']

/** Days after the welcome that each reminder goes out. A variant with none gets the welcome only. */
export const NUDGE_DAYS: Record<LeadVariant, number[]> = {
  saved_job: [3, 10],
  job_alert: [4, 12],
  newsletter: [7],
  waitlist: [3, 10],
  waitlist_b2b: [],
}

/** Only people who gave us an address this recently get a welcome, so switching the emails on never mails the back catalogue. */
export const WELCOME_WINDOW_MS = 48 * 60 * 60 * 1000

/** Minimum gap between two reminders, whatever the schedule says. */
export const MIN_NUDGE_GAP_MS = 3 * 24 * 60 * 60 * 1000

export const LEAD_LIST_KEY = 'website_leads'

/** Off until Justin has seen all four and says so: set LEAD_LIFECYCLE_EMAILS=1. */
export function lifecycleEmailsOn(): boolean {
  return process.env.LEAD_LIFECYCLE_EMAILS === '1'
}

export function stepsFor(variant: LeadVariant): LeadStep[] {
  const nudges = NUDGE_DAYS[variant].length
  return ['welcome', ...(['nudge1', 'nudge2'] as const).slice(0, nudges)]
}

const B2B_AUDIENCE = /employer|recruit|coach|organi[sz]ation|partner|school|college|universit|workforce/i

/**
 * What a waitlist signup is. The onboarding "no Gmail" box is a member already
 * mid-signup (no email from us), friend referrals are someone else's address
 * (never captured), business audiences get an acknowledgement, the rest are
 * candidates.
 */
export function waitlistVariant(audience: string): LeadVariant | null {
  if (audience === 'friend_referral' || audience === 'onboarding_no_gmail') return null
  return B2B_AUDIENCE.test(audience) ? 'waitlist_b2b' : 'waitlist'
}
