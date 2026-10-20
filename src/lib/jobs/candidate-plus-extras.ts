// Every member sees every job (owner's rule, 2026-10-16), and since 2026-10-20 every member also gets who to
// contact, the apply kit and explain-my-gaps (owner: Candidate+ is the mark recruiters see, not a lock on tools).
// What stays Candidate+: the intro request on a confidential search and "NextChapter knows someone here", which
// pass the member to a recruiter or to staff. A member without Candidate+ sees one plain line for those, saying
// what it does and where to see what's left to unlock it. Candidate+ status itself is isDossierUnlocked()
// (dossier-unlock.ts); nothing here recomputes it.

export type CandidatePlusExtra = 'who_to_contact' | 'request_intro' | 'apply_kit' | 'explain_gaps'

/** The extras every member has. The rest still need Candidate+. */
export const EXTRAS_OPEN_TO_EVERYONE: readonly CandidatePlusExtra[] = ['who_to_contact', 'apply_kit', 'explain_gaps']

export function extraIsOpen(extra: CandidatePlusExtra, candidatePlus: boolean): boolean {
  return candidatePlus || EXTRAS_OPEN_TO_EVERYONE.includes(extra)
}

export const CANDIDATE_PLUS_EXTRAS: Record<CandidatePlusExtra, { label: string; does: string }> = {
  who_to_contact: { label: 'Who to contact', does: 'the people to reach at this company and a note you can send them' },
  request_intro: { label: 'Request intro', does: 'we pass your profile to the recruiter running this confidential search' },
  apply_kit: { label: 'Apply kit', does: 'your answers to the usual application questions, ready to paste, and the résumé to send' },
  explain_gaps: { label: 'Explain my gaps', does: 'a plain-English read of what this job asks for that your résumé doesn’t show yet' },
}

/** The existing unlock path: the Portfolio page lists what's left to earn Candidate+. */
export const CANDIDATE_PLUS_UNLOCK_HREF = '/dashboard/portfolio'

/** The error a server action returns when a member without Candidate+ calls an extra directly. */
export function candidatePlusRequiredMessage(extra: CandidatePlusExtra): string {
  return `${CANDIDATE_PLUS_EXTRAS[extra].label} is part of Candidate+. Your Portfolio page shows what's left to unlock it.`
}
