// ATS parser matrix — Report Structure Spec §4. Reports a MATRIX per
// platform, never a single score (§4.3): "Parses cleanly: Greenhouse,
// Lever... Loses your job titles: Workday... Drops your dates: Taleo."
//
// Honesty note on scope: this simulates against the ATS_FLAGS already
// extracted from resume TEXT (extract-facts.ts) — the app never sees the
// original file layout at this stage, only extractedText. That text-level
// signal genuinely can carry inconsistent date formats, non-standard
// section names, and letter-spaced headings (all visible as character
// patterns in plain text), but it cannot independently confirm true
// visual-layout failures like multi-column placement or image-only PDFs —
// those are still LLM judgment calls on the raw text (extract-facts.ts's
// own prompt asks for them), not measured from the file. A real per-engine
// validation harness (§4.5 — actually submitting fixtures to Textkernel,
// Workday, etc. and diffing recovered fields) is out of scope here; that's
// real infrastructure work, not a scoring function. This module encodes
// each platform's documented fragility (§4.2) as deterministic rules over
// the flags/facts we do have — a best-effort simulation, not a live test.
//
// The `ncrawl` adapter set's own platform knowledge (src/lib/market/
// ats-companies.ts, ats-jobs.ts) is about which ATS a given employer USES
// for job postings — a different axis from candidate-resume parsing
// fragility, so it isn't reused here despite the spec's "existing
// infrastructure" note; that note applies to knowing which platforms
// matter enough to simulate, which this module already reflects by naming
// the same platform set.

import type { ResumeAnalysisFacts } from './extract-facts'

export interface AtsMatrixRow {
  parserKey: string
  parserLabel: string
  fieldsExpected: number
  fieldsRecovered: number
  failures: string[]
  severity: 'CLEAN' | 'PARTIAL' | 'FAILING'
}

type AtsFlagKind = ResumeAnalysisFacts['atsFlags'][number]['kind']

function hasFlag(facts: ResumeAnalysisFacts, kind: AtsFlagKind): boolean {
  return facts.atsFlags.some((f) => f.kind === kind)
}

function hasAnyHardFailure(facts: ResumeAnalysisFacts): boolean {
  return facts.atsFlags.some((f) => f.isHardFailure)
}

interface FieldCounts {
  expected: number
  // Fixed contact/identity fields checked once, plus 3 per role (title,
  // employer, date range) — same granularity as the spec's own example
  // ("Workday recovers 6 of your 9 job titles").
  roleCount: number
}

function countFields(facts: ResumeAnalysisFacts): FieldCounts {
  const fixedFields = ['name', 'email', 'phone', 'linkedin', 'location'].length
  return { expected: fixedFields + facts.roles.length * 3, roleCount: facts.roles.length }
}

function severityFor(expected: number, recovered: number): 'CLEAN' | 'PARTIAL' | 'FAILING' {
  if (recovered >= expected) return 'CLEAN'
  if (recovered / expected >= 0.7) return 'PARTIAL'
  return 'FAILING'
}

interface ParserProfile {
  key: string
  label: string
  simulate: (facts: ResumeAnalysisFacts, counts: FieldCounts) => { recovered: number; failures: string[] }
}

const PARSER_PROFILES: ParserProfile[] = [
  {
    key: 'PARSING_ENGINES',
    label: 'Parsing engines (Textkernel, Daxtra, HireAbility, Affinda, RChilli)',
    // Moderate tolerance — covers most of the market. Fails hard only on
    // true structural hard failures; graduated issues cost little.
    simulate: (facts, counts) => {
      if (hasAnyHardFailure(facts)) {
        return { recovered: Math.round(counts.expected * 0.15), failures: ['Most of the document failed to parse — structural layout issue'] }
      }
      return { recovered: counts.expected, failures: [] }
    },
  },
  {
    key: 'WORKDAY',
    label: 'Workday',
    // "Strict, re-keys into structured fields, breaks badly on multi-column
    // and tables" — beyond hard failures, section-boundary confusion
    // (non-standard section names, letter-spaced headings) costs titles.
    simulate: (facts, counts) => {
      if (hasAnyHardFailure(facts)) {
        return { recovered: Math.round(counts.expected * 0.1), failures: ['Multi-column or table layout broke the structured re-key'] }
      }
      const failures: string[] = []
      let recovered = counts.expected
      if (hasFlag(facts, 'NON_STANDARD_SECTION_NAME') || hasFlag(facts, 'LETTER_SPACED_HEADING')) {
        recovered -= counts.roleCount
        failures.push(`Job titles — section headers weren't recognized (${counts.roleCount} lost)`)
      }
      return { recovered, failures }
    },
  },
  {
    key: 'TALEO',
    label: 'Oracle Taleo',
    // "Legacy, keyword-literal, weakest format tolerance" — dings dates on
    // inconsistent formats, and is harsh on any flag at all.
    simulate: (facts, counts) => {
      if (hasAnyHardFailure(facts)) {
        return { recovered: 0, failures: ['Document did not parse at all'] }
      }
      const failures: string[] = []
      let recovered = counts.expected
      if (hasFlag(facts, 'INCONSISTENT_DATE_FORMAT')) {
        recovered -= counts.roleCount
        failures.push(`Dates — inconsistent formatting across entries (${counts.roleCount} lost)`)
      }
      if (hasFlag(facts, 'NON_STANDARD_FONT') || hasFlag(facts, 'UNINFORMATIVE_FILENAME')) {
        recovered -= 1
        failures.push('Some metadata not recovered — weakest format tolerance of the platforms tested')
      }
      return { recovered, failures }
    },
  },
  {
    key: 'BRASSRING',
    label: 'IBM BrassRing / Kenexa',
    // "Legacy, harsh"
    simulate: (facts, counts) => {
      if (hasAnyHardFailure(facts)) {
        return { recovered: 0, failures: ['Document did not parse at all'] }
      }
      const failures: string[] = []
      let recovered = counts.expected
      if (hasFlag(facts, 'LETTER_SPACED_HEADING')) {
        recovered -= counts.roleCount
        failures.push(`Job titles — letter-spaced headings broke tokenization (${counts.roleCount} lost)`)
      }
      return { recovered, failures }
    },
  },
  {
    key: 'ICIMS',
    label: 'iCIMS',
    // "Decent, header/footer sensitive" — text-level extraction can't
    // confirm header/footer placement, so this platform only reflects hard
    // failures here; the header/footer risk is real but unmeasured.
    simulate: (facts, counts) => {
      if (hasAnyHardFailure(facts)) {
        return { recovered: Math.round(counts.expected * 0.2), failures: ['Structural layout issue broke parsing'] }
      }
      return { recovered: counts.expected, failures: [] }
    },
  },
  {
    key: 'SUCCESSFACTORS',
    label: 'SAP SuccessFactors',
    // "Form-heavy" — content that doesn't map to a fixed form field is
    // dropped, which non-standard section names are a proxy for here.
    simulate: (facts, counts) => {
      if (hasAnyHardFailure(facts)) {
        return { recovered: Math.round(counts.expected * 0.2), failures: ['Structural layout issue broke parsing'] }
      }
      const failures: string[] = []
      let recovered = counts.expected
      if (hasFlag(facts, 'NON_STANDARD_SECTION_NAME')) {
        recovered -= 1
        failures.push("Content under non-standard section names didn't map to a form field")
      }
      return { recovered, failures }
    },
  },
  {
    key: 'MODERN_ATS',
    label: 'Greenhouse, Lever, Ashby, Workable',
    // "Modern, most forgiving" — only true hard failures cost anything.
    simulate: (facts, counts) => {
      if (hasAnyHardFailure(facts)) {
        return { recovered: Math.round(counts.expected * 0.3), failures: ['Structural layout issue broke parsing'] }
      }
      return { recovered: counts.expected, failures: [] }
    },
  },
]

export function simulateAtsCompatibility(facts: ResumeAnalysisFacts): AtsMatrixRow[] {
  const counts = countFields(facts)
  return PARSER_PROFILES.map((profile) => {
    const { recovered, failures } = profile.simulate(facts, counts)
    const clampedRecovered = Math.max(0, Math.min(counts.expected, recovered))
    return {
      parserKey: profile.key,
      parserLabel: profile.label,
      fieldsExpected: counts.expected,
      fieldsRecovered: clampedRecovered,
      failures,
      severity: severityFor(counts.expected, clampedRecovered),
    }
  })
}
