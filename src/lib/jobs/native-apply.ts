// Native one-click apply: for jobs posted directly on NextChapter by an employer
// (talent portal) or a recruiter, the member sends their application straight to
// the poster's NextChapter inbox instead of an employer site. Crawled and feed
// jobs (ncrawl, ats_feed) always apply on the employer's own site.
//
// Member-posted board listings ('candidate_referral') are named in the schema but
// no code path creates them yet, so there is no poster inbox to deliver to; they
// fall through to the normal employer-site apply.

export type NativePoster = { kind: 'employer'; id: string } | { kind: 'recruiter'; id: string }

export function nativePosterOf(p: {
  source: string
  submittedByEmployerId: string | null
  submittedByRecruiterId: string | null
}): NativePoster | null {
  if (p.source === 'employer' && p.submittedByEmployerId) return { kind: 'employer', id: p.submittedByEmployerId }
  if (p.source === 'recruiter' && p.submittedByRecruiterId) return { kind: 'recruiter', id: p.submittedByRecruiterId }
  return null
}

export const SHORT_ANSWER_MAX = 600
export const SHORT_ANSWER_COUNT = 2

/** The Candidate+ mark is signaled to the poster when true, and never in Confidential Search Mode. */
export function candidatePlusMarkFor(candidatePlus: boolean, confidentialSearchMode: boolean): boolean {
  return candidatePlus && !confidentialSearchMode
}

/** Exactly what the poster receives — the member reviews this, field by field, before sending. */
export interface ApplicationSnapshot {
  jobTitle: string
  companyLabel: string
  name: string
  email: string | null
  phone: string | null
  linkedInUrl: string | null
  location: string | null
  summary: string
  workAuthorization: string | null
  resume: { id: string; name: string } | null
  /** Candidate+ mark for the poster: true only when the member has it AND is not in Confidential Search Mode. */
  candidatePlus?: boolean
  /** Link to the member's dossier. Present only when the member chose to attach it on this application. */
  dossierUrl?: string | null
  answers: { question: string; answer: string }[]
}

export function cleanShortAnswers(raw: { question: string; answer: string }[] | undefined): { question: string; answer: string }[] {
  return (raw ?? [])
    .slice(0, SHORT_ANSWER_COUNT)
    .map((a) => ({ question: (a.question ?? '').trim().slice(0, 200), answer: (a.answer ?? '').trim().slice(0, SHORT_ANSWER_MAX) }))
    .filter((a) => a.answer.length > 0)
}

/** The message body delivered to the poster's inbox. Plain text: inboxes render it as-is. */
export function applicationMessage(s: ApplicationSnapshot): string {
  const lines = [
    `New application through NextChapter: ${s.jobTitle}${s.companyLabel ? ` (${s.companyLabel})` : ''}`,
    '',
    `Name: ${s.name}`,
    s.email && `Email: ${s.email}`,
    s.phone && `Phone: ${s.phone}`,
    s.linkedInUrl && `LinkedIn: ${s.linkedInUrl}`,
    s.location && `Location: ${s.location}`,
    s.workAuthorization && `Work authorization: ${s.workAuthorization}`,
    s.candidatePlus && 'Candidate+ member: this person has done the search work to earn the mark.',
    s.dossierUrl && `Dossier (attached by the candidate): ${s.dossierUrl}`,
    s.resume ? `Résumé: ${s.resume.name} (attached below)` : 'Résumé: none on file',
    '',
    s.summary && 'Summary',
    s.summary,
    ...s.answers.flatMap((a) => ['', a.question || 'Note from the candidate', a.answer]),
    '',
    'Reply here to reach the candidate.',
  ]
  return lines.filter((l): l is string => typeof l === 'string').join('\n').replace(/\n{3,}/g, '\n\n')
}
