// Every member sees every job (owner's rule, 2026-10-16). Candidate+ keeps the
// extras on a job, and only these: who to contact (with the intro request on a
// confidential search), the apply kit, and explain-my-gaps. A member without
// Candidate+ sees one plain line per extra, saying what it does and where to
// see what's left to unlock it. Candidate+ status itself is isDossierUnlocked()
// (dossier-unlock.ts); nothing here recomputes it.

export type CandidatePlusExtra = 'who_to_contact' | 'request_intro' | 'apply_kit' | 'explain_gaps'

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
