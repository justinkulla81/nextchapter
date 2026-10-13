/**
 * Funding pathways NextChapter watches by name, and what each means for us.
 *
 * Pure: no network, no database, no LLM. A pathway is read from a notice title
 * (an allowlist of patterns, not "everything except"). It only changes the
 * explanation text on a VIA_PARTNER notice; it never changes eligibility.
 *
 * The pattern behind all three is the Texas one: colleges and workforce boards
 * win and administer the money (Texas colleges approved for Workforce Pell; a
 * DOL grant to a college-led consortium), and NextChapter is the
 * professional-track provider inside it. NextChapter does not apply.
 */

export type FundingPathway = 'WORKFORCE_PELL' | 'DISLOCATED_WORKER' | 'AI_WORKFORCE'

const AI = /\bAI\b|artificial intelligence/i
const WORKFORCE_WORDS = /workforce|worker|skills?\b|training|literacy|reskill|upskill|reemployment|re-employment/i

export function fundingPathway(title: string): FundingPathway | null {
  if (/workforce pell|short-?term pell/i.test(title)) return 'WORKFORCE_PELL'
  // AI is checked before dislocated worker: the DOL's AI-triggered grants are
  // dislocated worker grants whose title names AI and reskilling.
  if ((AI.test(title) && WORKFORCE_WORDS.test(title)) || /rapid reskill/i.test(title)) return 'AI_WORKFORCE'
  if (/dislocated worker|displaced worker|rapid response|layoff aversion/i.test(title)) return 'DISLOCATED_WORKER'
  return null
}

/** Text appended to the VIA_PARTNER note. Plain statements; no promises about awards. */
export const PATHWAY_NOTE: Record<FundingPathway, string> = {
  WORKFORCE_PELL:
    "Workforce Pell is paid to accredited colleges for state-approved 8 to 15 week programs, so a college applies and not NextChapter. Texas pattern: colleges and boards win and run it, and NextChapter is the professional-track provider inside it, through a written arrangement with an outside provider for part of a program. Check the state's approval policy.",
  DISLOCATED_WORKER:
    'Dislocated worker money goes to state agencies and workforce boards. Texas pattern: colleges and boards win it, and NextChapter is the professional-track reemployment provider inside it as a subrecipient or vendor, serving the managers and professionals the formula programs rarely reach.',
  AI_WORKFORCE:
    'AI workforce money goes to states, boards, colleges and nonprofits. Texas pattern: they win it, and NextChapter is the professional-track provider inside it, covering the white-collar reskilling and job search the grant names.',
}

/** The note for a VIA_PARTNER notice: who can apply, then what that means for us. */
export function withPathwayNote(base: string, title: string | undefined): string {
  const p = title ? fundingPathway(title) : null
  return p ? `${base} ${PATHWAY_NOTE[p]}` : base
}
