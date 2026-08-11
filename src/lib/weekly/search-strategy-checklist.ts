// A self-contained "how much of Search Strategy is filled in" checklist —
// deliberately NOT threaded through action-effort.ts's PAGE_ACTION_TYPES/
// ACTION_TYPE_EFFORT (see PAGE_ACTION_TYPES['search-strategy'] === []): these
// 21 fields are one-off setup answers, not graded Search Actions, and mixing
// them into the Sprint/grading economy would pollute pointsNeededForA and
// the weekly points ramp. Points here are a completeness metric only — they
// don't feed weeklyPoints/weeklyPointsTarget anywhere. Mirrors the same
// non-invasive pattern as profile-checklist.ts.

export interface SearchStrategyChecklistItem {
  key: string
  label: string
  points: number
  href: string
}

export interface SearchStrategyChecklistProfile {
  gapDuration: string | null
  targetIndustries: string[]
  primaryFunction: string | null
  highestLevelReached: string | null
  targetRoleType: string | null
  remotePreference: string | null
  // The form pre-fills this field from work history when the candidate has
  // never explicitly set it — those pre-filled tags are real, visible
  // answers on the page even though nothing's been saved to targetIndustries
  // yet, so treating them as still "incomplete" was a false nag: the
  // candidate sees 3 industries already sitting there and no reason to act.
  inferredIndustries?: string[]
}

const POINTS_PER_ITEM = 5

// Only the fields with a real "unanswered" state that matters for matching —
// excludes optional free-text fields (dealBreakers, skillsToBuild, etc.)
// and boolean toggles (isPivoting, openToRelocation, etc.) where "unchecked"
// is a legitimate default answer, not a gap.
const FIELDS: {
  key: keyof SearchStrategyChecklistProfile
  label: string
  anchor: string
  isAnswered: (p: SearchStrategyChecklistProfile) => boolean
}[] = [
  {
    key: 'gapDuration',
    label: 'How long you have been searching',
    anchor: 'gapDuration',
    isAnswered: (p) => !!p.gapDuration,
  },
  {
    key: 'targetIndustries',
    label: 'Target industries',
    anchor: 'targetIndustries',
    isAnswered: (p) => p.targetIndustries.length > 0 || (p.inferredIndustries?.length ?? 0) > 0,
  },
  {
    key: 'primaryFunction',
    label: 'Your primary job function',
    anchor: 'primaryFunction',
    isAnswered: (p) => !!p.primaryFunction,
  },
  {
    key: 'highestLevelReached',
    label: 'Seniority — highest level reached',
    anchor: 'highestLevelReached',
    isAnswered: (p) => !!p.highestLevelReached,
  },
  {
    key: 'targetRoleType',
    label: 'Target role',
    anchor: 'targetRoleType',
    isAnswered: (p) => !!p.targetRoleType,
  },
  {
    key: 'remotePreference',
    label: 'Location preference',
    anchor: 'remotePreference',
    isAnswered: (p) => !!p.remotePreference,
  },
]

export interface SearchStrategyChecklist {
  incomplete: SearchStrategyChecklistItem[]
  totalPointsRemaining: number
}

export function computeSearchStrategyChecklist(profile: SearchStrategyChecklistProfile): SearchStrategyChecklist {
  const incomplete = FIELDS.filter((f) => !f.isAnswered(profile)).map((f) => ({
    key: f.key,
    label: f.label,
    points: POINTS_PER_ITEM,
    href: `/dashboard/search-strategy#${f.anchor}`,
  }))
  return { incomplete, totalPointsRemaining: incomplete.length * POINTS_PER_ITEM }
}
