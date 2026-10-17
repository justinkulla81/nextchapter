// Facts shown on the master's / MBA guardrail. Each carries its source so the
// card never states a number it cannot back. From the NextChapter White Collar
// Employment Report (Sept 2026), which cites the underlying publishers. Verify against the
// originals before adding a figure.

export interface GradRoiFact {
  text: string
  source: string
}

export const GRAD_ROI_FACTS: GradRoiFact[] = [
  {
    text: 'About 43% of master’s programs and 39% of MBA programs have a negative lifetime return on investment.',
    source: 'FREOPP, May 2024 (via the NextChapter White Collar Employment Report, Sept 2026)',
  },
  {
    text: 'Federal Grad PLUS loans ended for new borrowers on July 1, 2026. Graduate students can now borrow $20,500 a year ($100,000 total); professional students $50,000 a year ($200,000 total). More of the cost may be out of pocket or private.',
    source: 'U.S. Department of Education rules, via the NextChapter White Collar Employment Report, Sept 2026',
  },
  {
    text: 'Long-term unemployment has risen faster for master’s degree holders than for other degree levels, so another degree is not a shield against a long search.',
    source: 'NextChapter calculation from CPS microdata, Sept 2026 report (beyond margin of error)',
  },
  {
    text: 'For loans made on or after July 1, 2027, unemployment deferment ends and forbearance is capped at 9 months in any 24.',
    source: 'U.S. Department of Education rules, via the NextChapter White Collar Employment Report, Sept 2026',
  },
]

export const GRAD_ROI_ALTERNATIVES: string[] = [
  'Short, employer-validated credentials in the skill a target employer asks for, before committing to a full degree.',
  'Employer tuition benefits, if you are still employed or about to join an employer that offers them.',
  'A portfolio of AI work in your own function: three shipped projects with before and after results often does more than a credential.',
  'Workforce Pell for 8 to 15 week programs, where approved in your state (few programs approved so far, mostly trades and health care).',
]
