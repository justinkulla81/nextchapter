// Partners Master Build Script §C4.3 — the employer waitlist is "the
// important one," every field is sales intel, and the auto-scoring rule is
// explicit: "evaluating now + 50+ seats + has an incumbent = flagged for
// immediate outreach. Everything else nurtures." Pure functions, no
// server-only dependency, so they're easy to unit test and to call from
// both the form's client-side hint and the server action's authoritative
// check.

// §C4.3's qualifier — "business domains only." A short, maintained
// blocklist of common consumer webmail providers rather than a "positive"
// allowlist of business domains, since there's no way to enumerate every
// legitimate company domain in advance.
const CONSUMER_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'gmx.com',
  'yandex.com',
])

export function isBusinessEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1]
  if (!domain) return false
  return !CONSUMER_EMAIL_DOMAINS.has(domain)
}

export type EvaluatingWindow = 'now' | 'next_6_months' | 'exploring'
export type AnticipatedVolume = 'under_10' | '10_50' | '50_200' | '200_plus'

const VOLUME_MEETS_THRESHOLD: Record<AnticipatedVolume, boolean> = {
  under_10: false,
  '10_50': false,
  '50_200': true,
  '200_plus': true,
}

export interface EmployerWaitlistScoreInput {
  evaluatingWindow: EvaluatingWindow
  anticipatedVolume: AnticipatedVolume
  currentProvider: string
}

export interface EmployerWaitlistScore {
  flaggedForImmediateOutreach: boolean
  reason: string
}

// §C4.3's exact rule: evaluating now + 50+ seats + has an incumbent =
// immediate outreach. "none" and "" both mean "no incumbent."
export function scoreEmployerWaitlistLead(input: EmployerWaitlistScoreInput): EmployerWaitlistScore {
  const evaluatingNow = input.evaluatingWindow === 'now'
  const meetsVolume = VOLUME_MEETS_THRESHOLD[input.anticipatedVolume] ?? false
  const hasIncumbent = input.currentProvider.trim() !== '' && input.currentProvider.trim().toLowerCase() !== 'none'

  const flagged = evaluatingNow && meetsVolume && hasIncumbent

  const reason = flagged
    ? 'Evaluating now, 50+ anticipated seats, and has an incumbent — flagged for immediate outreach.'
    : 'Does not meet all three immediate-outreach criteria (evaluating now, 50+ seats, has an incumbent) — routed to nurture.'

  return { flaggedForImmediateOutreach: flagged, reason }
}
