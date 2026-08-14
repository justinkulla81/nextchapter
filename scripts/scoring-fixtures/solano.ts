// Fixture: Solano — Kwan's twin minus prestige (Master Build Script §16
// gate 2, "logo isolation"). Deliberately derived from kwan.ts via a deep
// clone plus overrides touching ONLY institution/employer names (and the
// candidate's own identity fields) — every scope number, date, bullet, and
// extracurricular entry is bit-for-bit identical to Kwan's. That is the
// point of the gate: computeAllDimensions never reads a company or school
// name, so Solano's dimension scores, experienceScore, and pre-prestige
// resume subtotal must come out identical to Kwan's. The only place they
// may legitimately diverge is resumeScore, and only because Solano's
// institution/employer names don't match the mock EliteInstitution/
// PrestigeEmployer rows the test file supplies (Kwan's do).

import type { ResumeAnalysisFacts } from '@/lib/scoring/resume-analysis/extract-facts'
import { kwanFacts } from './kwan'

const clone = structuredClone(kwanFacts) as ResumeAnalysisFacts

// Non-prestige-bearing company for every role (was "Alderbrook Consumer
// Holdings" / "Vantage Meridian Group").
clone.roles[0].company = 'Northfield Retail Partners'
clone.roles[1].company = 'Cresthaven Commerce Group'
clone.roles[2].company = 'Cresthaven Commerce Group'

// Non-elite institution (was "Radcliffe Endowed University").
clone.education[0].schoolName = 'Lakeside Regional University'

clone.candidateName = 'Marco Solano'

export const solanoFacts: ResumeAnalysisFacts = clone
