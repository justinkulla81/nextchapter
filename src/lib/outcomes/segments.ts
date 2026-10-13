// Segment tags used to tailor guidance, never to rank, score or deprioritize
// anyone. Age is used only when the candidate chose to tell us; we never infer
// it from graduation year or anything else.

export type OutcomeSegment = 'LONG_TENURED_55_64' | 'MASTERS_OR_25YR' | 'LAID_OFF_MANAGER'

export type AgeBandValue = 'UNDER_35' | 'A35_44' | 'A45_54' | 'A55_64' | 'A65_PLUS'

export interface SegmentInputs {
  ageBand: AgeBandValue | null
  yearsExperience: number | null
  hasMastersOrHigher: boolean
  laidOff: boolean
  seniorityBand: 'EARLY' | 'MID' | 'SENIOR' | 'EXECUTIVE' | null
}

export function deriveSegments(i: SegmentInputs): OutcomeSegment[] {
  const out: OutcomeSegment[] = []
  const longTenure = (i.yearsExperience ?? 0) >= 25
  if (i.ageBand === 'A55_64' && (i.yearsExperience === null || i.yearsExperience >= 10)) out.push('LONG_TENURED_55_64')
  if (i.hasMastersOrHigher || longTenure) out.push('MASTERS_OR_25YR')
  if (i.laidOff && (i.seniorityBand === 'SENIOR' || i.seniorityBand === 'EXECUTIVE')) out.push('LAID_OFF_MANAGER')
  return out
}

export interface SegmentGuidance {
  title: string
  points: string[]
}

// Guidance is practical and sourced from the NextChapter White Collar Employment Report
// (Sept 2026). It informs, it does not predict an individual's outcome.
export const SEGMENT_GUIDANCE: Record<OutcomeSegment, SegmentGuidance> = {
  LONG_TENURED_55_64: {
    title: 'For experienced professionals aged 55 to 64',
    points: [
      'Searches run longer at this stage: 39% of unemployed white-collar workers aged 55 to 64 had been out 27 weeks or more (Sept 2026 report). That is common, not a personal failing.',
      'Lead with introductions. People who come through a referral reach interview far more often than cold applicants.',
      'Consider bridge work while you search: interim, fractional or advisory roles keep your timeline moving and often lead to permanent offers.',
      'Show current AI skills with two or three real examples from your own field, so no one has to guess.',
    ],
  },
  MASTERS_OR_25YR: {
    title: 'For advanced-degree holders and 25-year veterans',
    points: [
      'A degree no longer shortens a search on its own: long-term unemployment rose fastest for master’s holders and for degree holders with 25 or more years of experience (Sept 2026 report).',
      'Aim at roles that need your judgment, and show it with a short portfolio of results rather than a longer résumé.',
      'Before paying for another degree, try a short credential an employer asks for. See the guardrail on the Learn page.',
    ],
  },
  LAID_OFF_MANAGER: {
    title: 'For laid-off managers and senior leaders',
    points: [
      'Middle-management postings are down sharply from their 2022 peak, so widen your target to adjacent roles: program, change, implementation and AI-adoption leadership.',
      'Interim and fractional leadership are real routes back, and they close the gap on your timeline.',
      'Use your network first: former colleagues and alumni who know your work can reach decision makers directly.',
    ],
  },
}
