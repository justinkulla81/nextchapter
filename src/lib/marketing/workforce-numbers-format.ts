// Pure half of the workforce page's "By the numbers" block (workforce-numbers.ts loads the raw
// counts). Rules: every figure is floored, never rounded up; a "+" marks a floored figure; a
// count that failed to load or is zero yields no tile at all, never a 0.

/**
 * A public count that never overstates the live one. Under 100 the exact number; then floored
 * to 10, 100 or 1,000 with a "+": 93 -> "93", 252 -> "250+", 40,538 -> "40,500+",
 * 526,992 -> "526,000+".
 */
export function floorCount(n: number): string {
  const v = Math.floor(n)
  if (v < 100) return v.toLocaleString('en-US')
  const step = v < 1_000 ? 10 : v < 100_000 ? 100 : 1_000
  const floored = Math.floor(v / step) * step
  return floored === v ? v.toLocaleString('en-US') : `${floored.toLocaleString('en-US')}+`
}

export interface WorkforceRaw {
  jobs: {
    live: number
    checked24h: number
    aiSkill: number
    government: number
    nonprofit: number
    academia: number
    flagged: number
    clearance: number
    employers: number
    occupations: number
    industries: number
    functions: number
    states: number
    places: number
    /** Entry / early-career jobs flagged no_experience_ok, training_provided and entry_ai (src/lib/jobs/entry-filters.ts); absent in older callers. */
    entryNoExp?: number
    entryTraining?: number
    entryAi?: number
  } | null
  taxonomy: {
    skills: number
    occupationsMapped: number
    similarityPairs: number
    courses: number
    aiCourses: number
    certifications: number
    jobCenters: number
    jobCenterStates: number
  } | null
  /** Like-for-like posted-pay premium for AI-skill jobs, only when it is positive. */
  aiPremiumPct: number | null
  pivots: { pivotPaths: number; pivotRoles: number } | null
  journeys: number | null
}

export interface WorkforceTile {
  key: string
  value: string
  label: string
  detail?: string
}

export interface WorkforceTileGroup {
  key: string
  title: string
  tiles: WorkforceTile[]
}

const ok = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0

/** "13,800+ government, 18,300+ nonprofit." — parts with no count are left out; nothing left, no sentence. */
function parts(list: [number, string][]): string | undefined {
  const shown = list.filter(([n]) => ok(n)).map(([n, label]) => `${floorCount(n)} ${label}`)
  return shown.length ? `${shown.join(', ')}.` : undefined
}

export function buildWorkforceTiles(raw: WorkforceRaw): WorkforceTileGroup[] {
  const j = raw.jobs
  const t = raw.taxonomy
  const tile = (cond: boolean, t: WorkforceTile): WorkforceTile[] => (cond ? [t] : [])

  const jobs: WorkforceTile[] = j
    ? [
        ...tile(ok(j.live), {
          key: 'live_jobs',
          value: floorCount(j.live),
          label: 'open jobs on the board',
          detail: 'Pulled from employer career sites and job sources, updated every day.',
        }),
        ...tile(ok(j.checked24h), {
          key: 'checked_24h',
          value: floorCount(j.checked24h),
          label: 'jobs checked live in the last 24 hours',
          detail: 'We confirm a posting is still up, and check again when someone clicks it.',
        }),
        ...tile(ok(j.employers), {
          key: 'employers',
          value: floorCount(j.employers),
          label: 'employers hiring now',
          detail: 'Distinct employers with at least one open job.',
        }),
        ...tile(ok(j.states), {
          key: 'states',
          value: j.states >= 51 ? '50 + DC' : floorCount(j.states),
          label: 'states with open jobs',
          detail: ok(j.places) ? `In ${floorCount(j.places)} cities and towns.` : undefined,
        }),
        ...tile(ok(j.government + j.nonprofit + j.academia), {
          key: 'public_mission',
          value: floorCount(j.government + j.nonprofit + j.academia),
          label: 'government, nonprofit and higher-ed jobs',
          detail: parts([
            [j.government, 'government'],
            [j.nonprofit, 'nonprofit'],
            [j.academia, 'colleges and universities'],
          ]),
        }),
        ...tile(ok(j.flagged), {
          key: 'requirement_flags',
          value: floorCount(j.flagged),
          label: 'jobs with hard requirements flagged up front',
          detail: `${ok(j.clearance) ? `Security clearance (${floorCount(j.clearance)}), ` : ''}citizenship, visa sponsorship, licenses, travel and on-site rules.`,
        }),
      ]
    : []

  const skills: WorkforceTile[] = [
    ...tile(!!j && ok(j.aiSkill), {
      key: 'ai_skill_jobs',
      value: j ? floorCount(j.aiSkill) : '',
      label: 'jobs asking for an AI skill',
      detail: 'The posting names a specific AI skill: using AI tools in the work, building with LLMs, or AI governance.',
    }),
    ...tile(ok(raw.aiPremiumPct), {
      key: 'ai_pay_premium',
      value: `${Math.floor(raw.aiPremiumPct ?? 0)}%`,
      label: 'higher posted pay for AI-skill jobs',
      detail: 'Like-for-like: same function, level and industry. Posted pay ranges only.',
    }),
    ...tile(!!j && ok(j.occupations), {
      key: 'occupations',
      value: j ? floorCount(j.occupations) : '',
      label: 'occupations with open jobs',
      detail: t && ok(t.occupationsMapped) ? `Standard O*NET-SOC codes, out of ${floorCount(t.occupationsMapped)} we map.` : 'Standard O*NET-SOC codes.',
    }),
    ...tile(!!j && ok(j.functions), {
      key: 'functions',
      value: j ? floorCount(j.functions) : '',
      label: 'job functions',
      detail: j && ok(j.industries) ? `Across ${floorCount(j.industries)} industries.` : undefined,
    }),
    ...tile(!!t && ok(t.skills), {
      key: 'skills',
      value: t ? floorCount(t.skills) : '',
      label: 'skills, knowledge areas and tools tracked',
      detail: 'From the U.S. Department of Labor’s O*NET, matched to job postings.',
    }),
    ...tile(!!t && ok(t.similarityPairs), {
      key: 'occupation_moves',
      value: t ? floorCount(t.similarityPairs) : '',
      label: 'occupation-to-occupation moves scored',
      detail: 'Each scored by shared skills, so members see jobs next to their own field.',
    }),
  ]

  const people: WorkforceTile[] = [
    ...tile(!!raw.pivots && ok(raw.pivots.pivotPaths), {
      key: 'pivot_paths',
      value: raw.pivots ? floorCount(raw.pivots.pivotPaths) : '',
      label: 'career pivot paths',
      detail: raw.pivots && ok(raw.pivots.pivotRoles)
        ? `Across ${floorCount(raw.pivots.pivotRoles)} roles, each with the skills that carry over and the gaps to close.`
        : 'Each with the skills that carry over and the gaps to close.',
    }),
    ...tile(!!t && ok(t.courses), {
      key: 'courses',
      value: t ? floorCount(t.courses) : '',
      label: 'courses and certifications in the library',
      detail: t ? parts([[t.aiCourses, 'AI courses'], [t.certifications, 'certifications mapped to job functions']]) : undefined,
    }),
    ...tile(ok(raw.journeys), {
      key: 'journeys',
      value: floorCount(raw.journeys ?? 0),
      label: 'member journeys',
      detail: 'Laid off, changing careers, returning to work, new grad and more. Each has its own plan.',
    }),
    ...tile(!!t && ok(t.jobCenters), {
      key: 'job_centers',
      value: t ? floorCount(t.jobCenters) : '',
      label: 'American Job Centers mapped',
      detail: 'So members can find in-person help near them.',
    }),
  ]

  return [
    { key: 'jobs', title: 'Jobs', tiles: jobs },
    { key: 'skills', title: 'Skills and AI', tiles: skills },
    { key: 'people', title: 'Pivots, learning and support', tiles: people },
  ].filter((g) => g.tiles.length > 0)
}

/**
 * The workforce page's one entry-level line: "X entry-level jobs welcome people with no experience; Y include a
 * training program; Z ask for AI skills." Floored like every tile; a zero or missing count drops its part (the
 * first part left names "entry-level jobs"), all gone = null.
 */
export function entryLevelLine(jobs: WorkforceRaw['jobs']): string | null {
  if (!jobs) return null
  const parts = (
    [
      [jobs.entryNoExp, 'welcome people with no experience'],
      [jobs.entryTraining, 'include a training program'],
      [jobs.entryAi, 'ask for AI skills'],
    ] as const
  )
    .filter(([n]) => !!n)
    .map(([n, what], i) => `${floorCount(n!)} ${i === 0 ? 'entry-level jobs ' : ''}${what}`)
  return parts.length ? `${parts.join('; ')}.` : null
}
