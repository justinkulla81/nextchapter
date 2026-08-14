// Dimension weights, seniority bands, and function-family evidence norms —
// Resume Scoring Spec §3.4/§5/§6. Config, not inline constants, so
// calibration (spec §10) doesn't require touching the scoring logic.

import type { DimensionKey, FunctionFamily, SeniorityBand } from './types'

// Executive band is the reference set (spec §3.4). Other bands apply the
// shift table below on top of these base weights, then renormalize to 100.
export const BASE_DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  evidenceQuality: 20,
  narrativePositioning: 15,
  atsLegibility: 15,
  scopeLevel: 12,
  trajectory: 10,
  mechanicsPresentation: 10,
  tenurePattern: 8,
  relevanceRecency: 5,
  skillCurrency: 3,
  contactability: 2,
}

// Multiplicative shift applied to the base weight before renormalizing —
// spec §5's "Evidence ↑" etc. 1.0 = unchanged. Renormalization (in
// getDimensionWeights below) is what keeps the sum at 100 regardless of
// how many dimensions shift, so band swaps never silently change the total.
const BAND_WEIGHT_SHIFTS: Record<SeniorityBand, Partial<Record<DimensionKey, number>>> = {
  EARLY: {
    scopeLevel: 0.5,
    trajectory: 0.5,
    // Extracurricular is a separate additive modifier (spec §4.12), not a
    // dimension — its own "↑ for Early" lives in modifiers.ts instead.
  },
  MID: {
    evidenceQuality: 1.15,
    skillCurrency: 1.5,
  },
  SENIOR: {
    scopeLevel: 1.25,
    trajectory: 1.2,
  },
  EXECUTIVE: {
    scopeLevel: 1.4,
    narrativePositioning: 1.3,
  },
}

export function getDimensionWeights(band: SeniorityBand): Record<DimensionKey, number> {
  const shifted = Object.fromEntries(
    (Object.entries(BASE_DIMENSION_WEIGHTS) as [DimensionKey, number][]).map(([key, base]) => [
      key,
      base * (BAND_WEIGHT_SHIFTS[band][key] ?? 1),
    ])
  ) as Record<DimensionKey, number>

  const total = Object.values(shifted).reduce((sum, w) => sum + w, 0)
  const scale = 100 / total
  return Object.fromEntries(
    (Object.entries(shifted) as [DimensionKey, number][]).map(([key, w]) => [key, w * scale])
  ) as Record<DimensionKey, number>
}

export interface SeniorityBandDefinition {
  band: SeniorityBand
  label: string
  yearsHint: string
  pageNormMin: number
  pageNormMax: number
}

// Bands set from stated level and scope first, years second (spec §5) —
// this table is the human-facing reference; the actual band detector
// (seniority-band.ts) weighs level/scope signals ahead of raw years.
export const SENIORITY_BAND_DEFINITIONS: SeniorityBandDefinition[] = [
  { band: 'EARLY', label: 'Early career', yearsHint: '0–5 yrs, IC', pageNormMin: 1, pageNormMax: 1 },
  { band: 'MID', label: 'Mid career', yearsHint: '6–12 yrs, senior IC / manager', pageNormMin: 1, pageNormMax: 2 },
  { band: 'SENIOR', label: 'Senior', yearsHint: '13–20 yrs, director / senior manager', pageNormMin: 2, pageNormMax: 2 },
  { band: 'EXECUTIVE', label: 'Executive', yearsHint: '20+ yrs, VP and above', pageNormMin: 2, pageNormMax: 3 },
]

export interface FunctionFamilyDefinition {
  family: FunctionFamily
  label: string
  expectedEvidence: string[]
  doNotExpect: string[]
}

// Spec §6 — Evidence Quality (and, secondarily, Scope & Level) score against
// the family's own expected-evidence set, never penalizing a candidate for
// lacking evidence types their function never produces.
export const FUNCTION_FAMILY_DEFINITIONS: FunctionFamilyDefinition[] = [
  {
    family: 'REVENUE',
    label: 'Revenue (Sales, CS, BD)',
    expectedEvidence: ['quota', 'attainment %', 'book size', 'growth rate', 'retention'],
    doNotExpect: ['technical artifacts'],
  },
  {
    family: 'MARKETING',
    label: 'Marketing',
    expectedEvidence: ['pipeline contribution', 'CAC', 'conversion', 'reach'],
    doNotExpect: ['direct revenue ownership below senior levels'],
  },
  {
    family: 'ENGINEERING',
    label: 'Engineering / Technical',
    expectedEvidence: ['systems', 'scale', 'latency', 'uptime', 'shipped products', 'team size'],
    doNotExpect: ['revenue', 'quota'],
  },
  {
    family: 'PRODUCT',
    label: 'Product',
    expectedEvidence: ['adoption', 'retention', 'launch outcomes', 'roadmap ownership'],
    doNotExpect: ['quota'],
  },
  {
    family: 'FINANCE',
    label: 'Finance / Accounting',
    expectedEvidence: ['budget size', 'close cycle', 'audit outcomes', 'savings'],
    doNotExpect: ['quota'],
  },
  {
    family: 'OPERATIONS',
    label: 'Operations / Supply Chain',
    expectedEvidence: ['throughput', 'cost per unit', 'SLA', 'headcount'],
    doNotExpect: ['revenue'],
  },
  {
    family: 'PEOPLE',
    label: 'People / HR',
    expectedEvidence: ['headcount supported', 'time-to-fill', 'retention', 'program reach'],
    doNotExpect: ['revenue'],
  },
  {
    family: 'LEGAL',
    label: 'Legal / Compliance',
    expectedEvidence: ['matter volume', 'risk outcomes', 'regulatory results'],
    doNotExpect: ['revenue metrics'],
  },
  {
    family: 'CLINICAL',
    label: 'Clinical / Healthcare',
    expectedEvidence: ['patient volume', 'outcomes', 'credentials', 'licensure'],
    doNotExpect: ['revenue'],
  },
  {
    family: 'GENERAL_MANAGEMENT',
    label: 'General Management',
    expectedEvidence: ['P&L', 'headcount', 'multi-function span'],
    doNotExpect: [],
  },
]

export function getFunctionFamilyDefinition(family: FunctionFamily): FunctionFamilyDefinition {
  return FUNCTION_FAMILY_DEFINITIONS.find((f) => f.family === family) ?? FUNCTION_FAMILY_DEFINITIONS[9]
}
