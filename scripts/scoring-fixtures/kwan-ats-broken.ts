// Fixture: Kwan, ATS-broken — same career facts as kwan.ts (identical
// roles[]/scope/education/extracurricular), but with atsFlags reflecting a
// two-column, tables-heavy, image-only-PDF layout. Master Build Script §16
// gate 14 ("component separation"): scoreAtsLegibility caps hard at 25 the
// moment any atsFlags entry has isHardFailure: true, and atsLegibility is a
// RESUME-only dimension (DIMENSION_COMPONENT), so resumeScore should drop
// sharply while experienceScore — built entirely from scopeLevel,
// trajectory, tenurePattern, relevanceRecency, and industryCoherence, none
// of which read atsFlags — must come out bit-for-bit identical to base
// Kwan's. The harness proves this rather than trusting the doc comment.

import type { ResumeAnalysisFacts } from '@/lib/scoring/resume-analysis/extract-facts'
import { kwanFacts } from './kwan'

const clone = structuredClone(kwanFacts) as ResumeAnalysisFacts

clone.atsFlags = [
  {
    kind: 'MULTI_COLUMN_EXPERIENCE',
    detail: 'Experience section is laid out in two columns.',
    isHardFailure: true,
  },
  {
    kind: 'TABLE_OR_TEXTBOX_CONTENT',
    detail: 'Dates and scope figures are placed in a table rather than inline text.',
    isHardFailure: true,
  },
  {
    kind: 'IMAGE_ONLY_PDF',
    detail: 'Header block (name, title, contact info) is a rendered image, not text.',
    isHardFailure: true,
  },
]
clone.mechanicsIssues = [
  ...clone.mechanicsIssues,
  {
    kind: 'ORPHANED_SECTION',
    quote: 'Skills',
    location: 'right-column sidebar',
  },
]

export const kwanAtsBrokenFacts: ResumeAnalysisFacts = clone
