// Dimension weights, seniority bands, and function-family evidence norms —
// Resume Scoring Spec §3.4/§5/§6, restructured per Master Build Script §3.1/
// §18 into two independent weight tables (Experience vs. Resume) instead of
// one flat 10-dimension sum — the two components are now separate 0-100
// composites, each renormalized to 100 on its own subset of dimensions, so
// they can be weighted, calibrated, and shifted by band independently.
// Config, not inline constants, so calibration (spec §10) doesn't require
// touching the scoring logic.

import type { DimensionKey, ExperienceResumeComponent, FunctionFamily, SeniorityBand } from './types'
import { DIMENSION_COMPONENT } from './types'

// Executive band is the reference set (spec §3.4). Other bands apply the
// shift tables below on top of these base weights, then renormalize each
// component's subset to 100 independently. Raw values are carried over
// unchanged from the pre-split single table (Phase 2) — industryCoherence
// is the one genuinely new weight, given a mid-pack raw value comparable to
// tenurePattern/relevanceRecency since it's a supporting signal, not the
// dominant one.
export const EXPERIENCE_DIMENSION_WEIGHTS: Record<string, number> = {
  scopeLevel: 12,
  trajectory: 10,
  tenurePattern: 8,
  relevanceRecency: 5,
  industryCoherence: 6,
  // Added for the Market Reality Grade recalibration (gaps and inconsistent
  // job function are two signals the user asked to penalize that had no
  // dimension at all until now) — weighted comparably to tenurePattern/
  // industryCoherence, the existing dimensions closest in kind.
  employmentGaps: 7,
  functionTrackConsistency: 6,
}

export const RESUME_DIMENSION_WEIGHTS: Record<string, number> = {
  quantification: 20,
  narrativePositioning: 15,
  atsLegibility: 15,
  mechanicsPresentation: 10,
  skillCurrency: 3,
  contactability: 2,
}

// Multiplicative shift applied to the base weight before renormalizing —
// spec §5's "Evidence ↑" etc. 1.0 = unchanged. Renormalization (in
// getExperienceDimensionWeights/getResumeDimensionWeights below) is what
// keeps each component's sum at 100 regardless of how many dimensions
// shift, so band swaps never silently change the total.
const EXPERIENCE_BAND_WEIGHT_SHIFTS: Record<SeniorityBand, Partial<Record<DimensionKey, number>>> = {
  EARLY: {
    scopeLevel: 0.5,
    trajectory: 0.5,
    // Extracurricular is a separate additive modifier (spec §4.12), not a
    // dimension — its own "↑ for Early" lives in modifiers.ts instead.
  },
  MID: {},
  SENIOR: {
    scopeLevel: 1.25,
    trajectory: 1.2,
  },
  EXECUTIVE: {
    scopeLevel: 1.4,
  },
}

const RESUME_BAND_WEIGHT_SHIFTS: Record<SeniorityBand, Partial<Record<DimensionKey, number>>> = {
  EARLY: {},
  MID: {
    quantification: 1.15,
    skillCurrency: 1.5,
  },
  SENIOR: {},
  EXECUTIVE: {
    narrativePositioning: 1.3,
  },
}

function renormalize(
  base: Record<string, number>,
  shifts: Partial<Record<DimensionKey, number>>
): Record<string, number> {
  const shifted = Object.fromEntries(
    Object.entries(base).map(([key, w]) => [key, w * (shifts[key as DimensionKey] ?? 1)])
  )
  const total = Object.values(shifted).reduce((sum, w) => sum + w, 0)
  const scale = 100 / total
  return Object.fromEntries(Object.entries(shifted).map(([key, w]) => [key, w * scale]))
}

export function getExperienceDimensionWeights(band: SeniorityBand): Record<string, number> {
  return renormalize(EXPERIENCE_DIMENSION_WEIGHTS, EXPERIENCE_BAND_WEIGHT_SHIFTS[band])
}

export function getResumeDimensionWeights(band: SeniorityBand): Record<string, number> {
  return renormalize(RESUME_DIMENSION_WEIGHTS, RESUME_BAND_WEIGHT_SHIFTS[band])
}

// Convenience — both components' weights keyed by dimension, for callers
// (self-check.ts) that need to validate a composite without caring which
// component a given dimension belongs to.
export function getDimensionWeightsByComponent(
  band: SeniorityBand
): Record<ExperienceResumeComponent, Record<string, number>> {
  return { EXPERIENCE: getExperienceDimensionWeights(band), RESUME: getResumeDimensionWeights(band) }
}

export { DIMENSION_COMPONENT }

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
