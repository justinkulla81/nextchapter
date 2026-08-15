import 'server-only'

// §4.5: "Neutral subject lines. Nothing containing 'job search,' 'resume,'
// 'application,' 'interview,' or 'career transition.' Work email and shared
// screens are the threat model." Applied to every sender that (a) has a
// literal, static subject containing one of these terms, or (b) builds its
// subject from LLM output that isn't otherwise constrained — see
// send-resume-lead-confirmation.ts, send-daily-action-email.ts, and
// send-midweek-checkin.ts for the three actual call sites (audited every
// src/lib/email/send-*.ts sender; these were the only ones whose subject
// could ever contain one of these terms).
const SEARCH_IDENTIFYING_SUBJECT_TERMS = [/job search/i, /resume/i, /application/i, /interview/i, /career transition/i]

// Falls back to a subject that's true of every email NextChapter sends,
// deliberately generic — no reference to search activity, no name of the
// specific feature that triggered it.
const NEUTRAL_FALLBACK_SUBJECT = 'An update from NextChapter'

export function neutralizeEmailSubject(subject: string, confidentialSearchMode: boolean): string {
  if (!confidentialSearchMode) return subject
  const flagged = SEARCH_IDENTIFYING_SUBJECT_TERMS.some((term) => term.test(subject))
  return flagged ? NEUTRAL_FALLBACK_SUBJECT : subject
}
