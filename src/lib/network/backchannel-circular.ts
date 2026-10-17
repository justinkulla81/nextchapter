// A Gmail-detected application takes its company name from the sender's
// domain (classify-email.ts), and a Gmail-detected contact takes its
// inferredCompany from the same kind of domain guess (email-domain.ts). When
// both came from the same mail, they "match" only because they are the same
// guess, not because the candidate knows anyone there — which is how a fake
// recruiter on ourrecruitingteam.org became "someone you know at
// Ourrecruitingteam". Such a pair is not backchannel evidence.
export function isCircularEmailMatch(input: {
  jobSource: string
  contactSource: string
  // True when the contact matched only through its inferred company, not a
  // company the candidate or an import actually recorded.
  matchedOnlyByInference: boolean
}): boolean {
  return input.jobSource === 'EMAIL_DETECTED' && input.contactSource === 'EMAIL_DETECTED' && input.matchedOnlyByInference
}
