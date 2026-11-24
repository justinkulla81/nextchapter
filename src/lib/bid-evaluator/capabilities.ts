/**
 * What NextChapter delivers, by service line, for the document reader and the completer. Pure.
 * The three lines match the evaluator's "are we eligible for training, software, coaching" question.
 */

export type ServiceLine = 'training' | 'software' | 'coaching'

export const SERVICE_LINES: { key: ServiceLine; label: string; what: string }[] = [
  {
    key: 'training',
    label: 'Training',
    what: 'AI reskilling and career-pivot courses for managers and professionals (online, self-paced and cohort), and layoff-response workshops.',
  },
  {
    key: 'software',
    label: 'Software',
    what: 'A layoff-response and career-transition platform: a program workspace for a board or college, a public sign-up page, participant seats, job matching to local openings, labor-market data, outcome counts.',
  },
  {
    key: 'coaching',
    label: 'Coaching',
    what: 'One-to-one and group career coaching for laid-off professionals: job search, résumé, career pivots.',
  },
]

/** Mission and vision, exactly as the owner wrote them (CLAUDE.md). Never reworded. */
export const MISSION = 'Our mission is to ensure every person knows the dignity of work.'
export const VISION =
  'Jobs sustain people, communities and economies. But work is changing faster than anyone can keep up with alone. We envision a job market where communities come together, so every person has the support, resources and opportunities to take their next step.'

export const COMPANY_SUMMARY = `NextChapter is a for-profit small business. It serves laid-off and at-risk managers and professionals (white-collar workers) and sells to workforce boards, American Job Centers, state workforce agencies, colleges and employers. It delivers remotely (online); it does not run job centers, case management, eligibility or federal WIOA reporting systems, and it does not staff physical offices.
Service lines:
${SERVICE_LINES.map((s) => `- ${s.label}: ${s.what}`).join('\n')}`
