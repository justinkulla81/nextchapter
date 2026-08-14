// Fixture: Kwan, unquantified — same roles[]/scope facts as base Kwan
// (identical dates, titles, companies, budgetOrPnlUsd/headcount role-level
// scope numbers, education, extracurricular), but every bullet has its
// numbers stripped: hasAnyNumber/hasBaselinePair both false, and the bullet
// text itself rewritten with no literal figures. Master Build Script §16
// gate 14 ("component separation"), second half: quantification is a
// RESUME-only dimension driven entirely by the per-bullet flags, while
// scopeLevel/trajectory (Your Experience) read the role-level scope fields
// directly and never touch bullet text — so resumeScore should still drop
// (quantification collapses) while experienceScore stays exactly the same
// as base Kwan's, proving the same DIMENSION_COMPONENT separation from the
// opposite direction (document quantification vs. role-level scope facts).

import type { ResumeAnalysisFacts } from '@/lib/scoring/resume-analysis/extract-facts'
import { kwanFacts } from './kwan'

const clone = structuredClone(kwanFacts) as ResumeAnalysisFacts

const UNQUANTIFIED_BULLETS: Record<number, string[]> = {
  0: [
    'Grew private-label gross margin significantly over several years by renegotiating vendor terms across the top SKUs.',
    'Built and led a large merchandising organization spanning apparel, home, and seasonal categories.',
    'Launched a private-label program that reached meaningful annual revenue within a few years of inception.',
  ],
  1: [
    'Scaled the operating P&L substantially while expanding into EMEA, opening many new stores in under two years.',
    'Cut supply chain cost per unit by consolidating several regional distribution networks into one.',
    'Grew the global operations team considerably across several countries.',
  ],
  2: [
    "Took full P&L ownership and grew it substantially over three years, adding an APAC region from a standing start.",
    'Grew the organization considerably while holding SG&A flat as a percentage of revenue.',
    "Sit on the CEO's executive committee; own the annual operating plan presented to the board.",
  ],
}

clone.roles = clone.roles.map((role, i) => ({
  ...role,
  bullets: role.bullets.map((bullet, j) => ({
    text: UNQUANTIFIED_BULLETS[i][j],
    isOutcomeNotActivity: bullet.isOutcomeNotActivity,
    hasBaselinePair: false,
    hasAnyNumber: false,
  })),
}))

export const kwanUnquantifiedFacts: ResumeAnalysisFacts = clone
