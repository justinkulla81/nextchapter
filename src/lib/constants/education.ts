import type { HighestEducationLevel } from '@prisma/client'

// Collapsed from the old dropdown-plus-checkbox hybrid (which listed
// MBA/MPH/DO/PharmD/DDS/DVM/PsyD/Other) into one multiselect, since almost
// no candidates here hold those niche credentials and JD/MD/PhD already
// cover the ones that matter for job-credential gating (see
// src/lib/jobs/credential-gate.ts). MBA is broken out from the generic
// Master's bucket since it's a distinct, commonly-held credential worth
// naming explicitly rather than folding into "Other Masters" — both still
// rank equally in LEVEL_RANK below. The older enum values still exist in
// the schema for backward compatibility with already-stored data.
export const DEGREE_OPTIONS: { value: HighestEducationLevel; label: string }[] = [
  { value: 'HIGH_SCHOOL', label: 'High school' },
  { value: 'SOME_COLLEGE', label: 'Some college, no degree' },
  { value: 'ASSOCIATE', label: "Associate's degree" },
  { value: 'BACHELORS', label: "Bachelor's degree" },
  { value: 'MBA', label: 'MBA' },
  { value: 'MASTERS', label: 'Other Masters' },
  { value: 'JD', label: 'JD (law degree)' },
  { value: 'MD', label: 'MD' },
  { value: 'PHD', label: 'PhD' },
]

// Used to derive the single "highest" value the rest of the app reads
// (narrative weakness detection, admin correlation dashboard) from a set of
// checked degrees. JD/MD/PhD all rank above Master's since holding one of
// those doesn't imply anything about whether a candidate also has a
// separate master's.
export const LEVEL_RANK: Record<HighestEducationLevel, number> = {
  HIGH_SCHOOL: 1,
  SOME_COLLEGE: 2,
  ASSOCIATE: 3,
  BACHELORS: 4,
  MASTERS: 5,
  MBA: 5,
  MPH: 5,
  PHARMD: 6,
  DDS: 6,
  DVM: 6,
  PSYD: 6,
  JD: 6,
  MD: 6,
  DO: 6,
  PHD: 6,
  OTHER: 5,
}

// A pre-existing highestEducationLevel from resume extraction that isn't
// one of the 8 offered options (e.g. MBA, MPH, DO) still needs to show up
// as *something* checked rather than silently looking unanswered — treat
// any legacy graduate-level value as "Master's" for display purposes only;
// saving the form re-derives highestEducationLevel from the checked set
// going forward.
export function legacyLevelToOption(level: HighestEducationLevel): HighestEducationLevel {
  if (DEGREE_OPTIONS.some((o) => o.value === level)) return level
  return 'MASTERS'
}

// A graduate-level credential (Master's/MBA/JD/MD/PhD/etc., LEVEL_RANK 5-6)
// necessarily means a Bachelor's was completed first, which in turn means
// high school was — resume extraction only ever confirms the highest
// credential it can find, so without this the lower ones stay unchecked
// even though holding the higher one guarantees them. Associate's implies
// high school but not a Bachelor's (that's a separate, non-guaranteed
// path), so it's left alone.
export function impliedLevels(checked: Set<HighestEducationLevel>): Set<HighestEducationLevel> {
  const withImplied = new Set(checked)
  const hasGraduateLevel = [...checked].some((level) => LEVEL_RANK[level] >= 5)
  if (hasGraduateLevel) withImplied.add('BACHELORS')
  if (hasGraduateLevel || withImplied.has('BACHELORS') || withImplied.has('ASSOCIATE')) {
    withImplied.add('HIGH_SCHOOL')
  }
  return withImplied
}

// Picks the single highestEducationLevel to store from a set of checked
// degree checkboxes — highest LEVEL_RANK wins; PHD > MD > JD breaks ties
// within rank 6 since a PhD is the least ambiguous "top" signal.
export function deriveHighestLevel(checked: Set<HighestEducationLevel>): HighestEducationLevel | null {
  if (checked.size === 0) return null
  if (checked.has('PHD')) return 'PHD'
  if (checked.has('MD')) return 'MD'
  if (checked.has('JD')) return 'JD'
  let best: HighestEducationLevel | null = null
  for (const level of checked) {
    if (!best || LEVEL_RANK[level] > LEVEL_RANK[best]) best = level
  }
  return best
}
