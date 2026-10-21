import { describe, it, expect } from 'vitest'
import {
  checkRequirement,
  checkRequirements,
  flagsFromTags,
  hasHardBlocker,
  isClearedJobFor,
  parseRequirementFlags,
  requirementLabel,
  requirementMemberOf,
  requirementTagsFor,
  type RequirementFlag,
  type RequirementMember,
  type RequirementProfile,
} from '@/lib/jobs/requirements'
import {
  hiddenFromShown,
  parseSectorsParam,
  sectorKeep,
  sectorOf,
  sectorsParam,
  shownFromHidden,
} from '@/lib/jobs/employer-sector'
import { functionKeep, functionLabelFor, memberVocabularyFunction, parseFunctionParam, JOB_FUNCTION_OPTIONS } from '@/lib/jobs/job-functions'
import { combineKeeps, requirementKeeps, surfacedPassesBoardFilters } from '@/lib/jobs/board-filters'
import { canonicalIndustry } from '@/lib/jobs/import-optional-fields'
import { matchJobToCandidate, type MatchCandidate, type MatchJob } from '@/lib/jobs/job-match'
import { boardHref } from '@/lib/jobs/board-url'

const tsSci: RequirementFlag = { flag: 'clearance', level: 'ts_sci', active: true, polygraph: null }

const member = (o: Partial<RequirementMember> = {}): RequirementMember => ({
  clearanceLevel: null,
  clearanceActive: null,
  clearancePolygraph: null,
  licensesHeld: [],
  licensesAnsweredAt: null,
  workAuthorization: null,
  maxTravelPct: null,
  openToRelocation: false,
  relocationAsked: false,
  remotePreference: null,
  currentState: null,
  ...o,
})

describe('requirement labels', () => {
  it('reads the way the spec asks', () => {
    expect(requirementLabel(tsSci)).toBe('Requires active TS/SCI')
    expect(requirementLabel({ ...tsSci, polygraph: 'full_scope' })).toBe('Requires active TS/SCI with full-scope polygraph')
    expect(requirementLabel({ flag: 'clearance', level: 'secret', active: false, polygraph: null })).toBe('Must be able to obtain Secret clearance')
    expect(requirementLabel({ flag: 'us_citizen' })).toBe('US citizens only')
    expect(requirementLabel({ flag: 'no_sponsorship' })).toBe('No visa sponsorship')
    expect(requirementLabel({ flag: 'license', key: 'cpa' })).toBe('CPA required')
    expect(requirementLabel({ flag: 'travel', pct: 50 })).toBe('Up to 50% travel')
  })
})

describe('parsing and tags', () => {
  it('drops unknown shapes, keeps one per flag, and round-trips through tags', () => {
    const flags = parseRequirementFlags([
      { flag: 'clearance', level: 'ts_sci', active: true, polygraph: 'full_scope', evidence: 'must hold an active TS/SCI with FS poly' },
      { flag: 'clearance', level: 'secret', active: false },
      { flag: 'license', key: 'cpa' },
      { flag: 'license', key: 'made_up' },
      { flag: 'travel', pct: 40 },
      { flag: 'travel', pct: 400 },
      { flag: 'nonsense' },
      { flag: 'us_citizen' },
      'junk',
    ])
    expect(flags.map((f) => f.flag)).toEqual(['clearance', 'license', 'travel', 'us_citizen'])
    const tags = requirementTagsFor(flags)!
    expect(tags).toContain('clr:ts_sci')
    const back = flagsFromTags(tags)
    expect(back).toContainEqual({ flag: 'clearance', level: 'ts_sci', active: true, polygraph: 'full_scope' })
    expect(back).toContainEqual({ flag: 'license', key: 'cpa' })
    expect(back).toContainEqual({ flag: 'travel', pct: 40 })
    expect(requirementTagsFor([])).toBeNull()
    expect(parseRequirementFlags(null)).toEqual([])
  })
})

describe('requirements against the member', () => {
  it('a member without a clearance gets a red flag on an active TS/SCI job', () => {
    const c = checkRequirement(tsSci, member({ clearanceLevel: 'none' }))
    expect(c.status).toBe('blocker')
    expect(c.message).toBe("Requires active TS/SCI — you told us you don't hold a clearance")
  })
  it('an unanswered clearance is neutral, with a one-click way to answer', () => {
    const c = checkRequirement(tsSci, member())
    expect(c.status).toBe('unknown')
    expect(c.answer?.href).toContain('/dashboard/profile/screening')
  })
  it('clearance level, lapse and polygraph', () => {
    expect(checkRequirement(tsSci, member({ clearanceLevel: 'secret', clearanceActive: true })).status).toBe('blocker')
    expect(checkRequirement(tsSci, member({ clearanceLevel: 'ts_sci', clearanceActive: false })).status).toBe('blocker')
    expect(checkRequirement(tsSci, member({ clearanceLevel: 'ts_sci', clearanceActive: true })).status).toBe('ok')
    const fs: RequirementFlag = { ...tsSci, polygraph: 'full_scope' }
    expect(checkRequirement(fs, member({ clearanceLevel: 'ts_sci', clearanceActive: true, clearancePolygraph: 'ci' })).status).toBe('blocker')
    expect(checkRequirement(fs, member({ clearanceLevel: 'ts_sci', clearanceActive: true, clearancePolygraph: 'full_scope' })).status).toBe('ok')
    // "Able to obtain" is not a blocker for someone without one.
    const obtain: RequirementFlag = { flag: 'clearance', level: 'secret', active: false, polygraph: null }
    expect(checkRequirement(obtain, member({ clearanceLevel: 'none' })).status).toBe('ok')
  })
  it('citizenship and sponsorship use the existing work-authorization answer', () => {
    const cit: RequirementFlag = { flag: 'us_citizen' }
    expect(checkRequirement(cit, member({ workAuthorization: 'us_citizen' })).status).toBe('ok')
    expect(checkRequirement(cit, member({ workAuthorization: 'permanent_resident' })).status).toBe('blocker')
    expect(checkRequirement(cit, member({ workAuthorization: 'need_sponsorship' })).status).toBe('blocker')
    // "Authorized, no sponsorship" doesn't say citizen or not: ask, don't guess.
    expect(checkRequirement(cit, member({ workAuthorization: 'work_authorized_no_sponsorship' })).status).toBe('unknown')
    const spon: RequirementFlag = { flag: 'no_sponsorship' }
    expect(checkRequirement(spon, member({ workAuthorization: 'need_sponsorship' })).status).toBe('blocker')
    expect(checkRequirement(spon, member({ workAuthorization: 'permanent_resident' })).status).toBe('ok')
    expect(checkRequirement(spon, member()).status).toBe('unknown')
  })
  it('licenses, travel, relocation, onsite', () => {
    const cpa: RequirementFlag = { flag: 'license', key: 'cpa' }
    expect(checkRequirement(cpa, member()).status).toBe('unknown')
    expect(checkRequirement(cpa, member({ licensesAnsweredAt: new Date(), licensesHeld: ['pmp'] })).status).toBe('blocker')
    expect(checkRequirement(cpa, member({ licensesAnsweredAt: new Date(), licensesHeld: ['cpa'] })).status).toBe('ok')
    const travel: RequirementFlag = { flag: 'travel', pct: 50 }
    expect(checkRequirement(travel, member({ maxTravelPct: 25 })).status).toBe('blocker')
    expect(checkRequirement(travel, member({ maxTravelPct: 50 })).status).toBe('ok')
    expect(checkRequirement(travel, member({ maxTravelPct: 75 })).status).toBe('ok')
    expect(checkRequirement({ flag: 'travel', pct: 90 }, member({ maxTravelPct: 75 })).status).toBe('ok')
    const reloc: RequirementFlag = { flag: 'relocation' }
    expect(checkRequirement(reloc, member()).status).toBe('unknown')
    expect(checkRequirement(reloc, member({ relocationAsked: true })).status).toBe('blocker')
    expect(checkRequirement(reloc, member({ relocationAsked: true, currentState: 'va' }), { locationState: 'VA' }).status).toBe('ok')
    expect(checkRequirement(reloc, member({ relocationAsked: true, openToRelocation: true })).status).toBe('ok')
    const onsite: RequirementFlag = { flag: 'onsite' }
    expect(checkRequirement(onsite, member({ remotePreference: 'remote' })).status).toBe('blocker')
    expect(checkRequirement(onsite, member({ remotePreference: 'hybrid' })).status).toBe('ok')
    expect(checkRequirement(onsite, member()).status).toBe('unknown')
  })
  it('orders blockers first and leaves light travel out', () => {
    const checks = checkRequirements(
      [{ flag: 'travel', pct: 10 }, { flag: 'onsite' }, tsSci],
      member({ clearanceLevel: 'none' })
    )
    expect(checks.map((c) => [c.flag, c.status])).toEqual([
      ['clearance', 'blocker'],
      ['onsite', 'unknown'],
    ])
  })
  it('the old travel yes counts as up to 50%; relocation counts as asked after onboarding or Search strategy', () => {
    const p: RequirementProfile = {
      clearanceLevel: null, clearanceActive: null, clearancePolygraph: null, licensesHeld: [], licensesAnsweredAt: null,
      workAuthorization: null, maxTravelPct: null, travelWillingness: true, openToRelocation: false,
      searchStrategyConfirmedAt: null, onboardingLocationConfirmedAt: new Date(), remotePreference: null, currentState: null,
    }
    const m = requirementMemberOf(p)
    expect(m.maxTravelPct).toBe(50)
    expect(m.relocationAsked).toBe(true)
  })
  it('hard blockers and cleared jobs', () => {
    expect(hasHardBlocker([tsSci], member({ clearanceLevel: 'none' }))).toBe(true)
    expect(hasHardBlocker([tsSci], member())).toBe(false)
    const cleared = member({ clearanceLevel: 'top_secret', clearanceActive: true })
    expect(isClearedJobFor([{ flag: 'clearance', level: 'secret', active: true, polygraph: null }], cleared)).toBe(true)
    expect(isClearedJobFor([tsSci], cleared)).toBe(false)
    expect(isClearedJobFor([{ flag: 'onsite' }], cleared)).toBe(false)
  })
})

describe('board filters', () => {
  const profile: RequirementProfile = {
    clearanceLevel: 'none', clearanceActive: null, clearancePolygraph: null, licensesHeld: [], licensesAnsweredAt: null,
    workAuthorization: 'us_citizen', maxTravelPct: null, travelWillingness: false, openToRelocation: false,
    searchStrategyConfirmedAt: new Date(), onboardingLocationConfirmedAt: null, remotePreference: 'remote', currentState: 'VA',
  }
  const row = (targetFunction: string | null, flags: RequirementFlag[]) => ({ targetFunction, requirementTags: requirementTagsFor(flags) })
  it('function, hide-blockers and cleared-jobs predicates', () => {
    const [byFn] = requirementKeeps({ functionKey: 'data_ai', sectorsShown: ['private'], hideBlockers: false, clearedOnly: false }, profile)
    expect(byFn(row('Data & Analytics', []))).toBe(true)
    expect(byFn(row('Engineering', []))).toBe(false)
    const [hide] = requirementKeeps({ functionKey: null, sectorsShown: [], hideBlockers: true, clearedOnly: false }, profile)
    expect(hide(row(null, [tsSci]))).toBe(false)
    expect(hide(row(null, [{ flag: 'onsite' }]))).toBe(false)
    expect(hide(row(null, [{ flag: 'us_citizen' }]))).toBe(true)
    // Relocation needs the job's state, which a light row lacks: never hidden by the board filter.
    expect(hide(row(null, [{ flag: 'relocation' }]))).toBe(true)
    expect(hide(row(null, []))).toBe(true)
    expect(combineKeeps([])).toBeUndefined()
    expect(combineKeeps<number>([(n) => n > 1, null, (n) => n < 5])!(3)).toBe(true)
  })
  it('partner-search jobs only pass when no data-dependent filter is on', () => {
    expect(surfacedPassesBoardFilters({ functionKey: null, sectorsShown: ['private', 'government', 'nonprofit', 'academia'], hideBlockers: true, clearedOnly: false })).toBe(true)
    expect(surfacedPassesBoardFilters({ functionKey: 'sales', sectorsShown: ['private'], hideBlockers: false, clearedOnly: false })).toBe(false)
    expect(surfacedPassesBoardFilters({ functionKey: null, sectorsShown: ['government'], hideBlockers: false, clearedOnly: false })).toBe(false)
  })
  it('board links keep the new filters', () => {
    const href = boardHref('fn=data_ai&sectors=private%2Cgovernment&blockers=hide&cleared=1', { view: 'fresh' })
    const sp = new URLSearchParams(href.slice(1))
    expect(sp.get('fn')).toBe('data_ai')
    expect(sp.get('sectors')).toBe('private,government')
    expect(sp.get('blockers')).toBe('hide')
    expect(sp.get('cleared')).toBe('1')
  })
})

describe('employer sector', () => {
  it('parses, defaults to private and filters', () => {
    expect(sectorOf(null)).toBe('private')
    expect(sectorOf('academia')).toBe('academia')
    expect(parseSectorsParam(null)).toBeNull()
    expect(parseSectorsParam('government,bogus,academia')).toEqual(['government', 'academia'])
    expect(sectorsParam(['private', 'government', 'nonprofit', 'academia'])).toBeNull()
    expect(sectorsParam(['academia', 'private'])).toBe('private,academia')
    expect(shownFromHidden(['government'])).toEqual(['private', 'nonprofit', 'academia'])
    expect(hiddenFromShown(['private'])).toEqual(['government', 'nonprofit', 'academia'])
    expect(sectorKeep([])).toBeNull()
    const keep = sectorKeep(['government'])!
    expect(keep({ employerSector: 'government' })).toBe(false)
    expect(keep({ employerSector: null })).toBe(true)
  })
})

describe('job function', () => {
  it('maps crawler codes to labels, keeps member-vocabulary labels for fit', () => {
    expect(functionLabelFor('data_ai')).toBe('Data & Analytics')
    expect(functionLabelFor('people')).toBe('Human Resources')
    expect(functionLabelFor('Clinical')).toBe('Clinical')
    expect(functionLabelFor('')).toBeNull()
    expect(functionLabelFor('astrology')).toBeNull()
    expect(parseFunctionParam('DATA_AI')).toBe('data_ai')
    expect(parseFunctionParam('nope')).toBeNull()
    expect(functionKeep('clinical')({ targetFunction: 'clinical' })).toBe(true)
    expect(memberVocabularyFunction('Engineering')).toBe('Engineering')
    expect(memberVocabularyFunction('Clinical')).toBeNull()
    expect(memberVocabularyFunction('Finance & Accounting')).toBe('Finance & Accounting')
    // 5+ options: the filter is a searchable list, not buttons.
    expect(JOB_FUNCTION_OPTIONS.length).toBeGreaterThanOrEqual(5)
  })
  it('folds stray industry labels into the canonical list', () => {
    expect(canonicalIndustry('finance')).toBe('financial_services')
    expect(canonicalIndustry('Manufacturing')).toBe('industrial')
    expect(canonicalIndustry('higher_education')).toBe('education')
    expect(canonicalIndustry('association')).toBe('nonprofit')
    expect(canonicalIndustry('technology')).toBe('technology')
    expect(canonicalIndustry('  ')).toBeNull()
  })
})

describe('fit shows a red flag for a requirement the member does not meet', () => {
  const candidate = {
    resumeKeywords: ['python'], confirmedSkillsHave: [], certifications: [], yearsExperience: 10, hasJD: false, hasMD: false, hasDO: false,
    isPeopleManager: true, teamSizeManaged: 5, targetCompanySize: null, targetCompanyStage: null, priorityMission: null,
    priorityWorkLife: null, priorityJobSecurity: null, priorityBrandName: null, equityImportant: false, targetCompMin: null,
    compFlexible: false, lastSalary: null, targetRoleType: 'Data Engineer', targetFunction: 'Engineering', primaryFunction: 'Engineering',
    secondaryFunction: null, targetIndustries: [], industryContext: null, isPivoting: false, highestLevelReached: 'Director',
    levelRankScore: null, willingToStartLower: false, remotePreference: 'flexible', currentCity: 'Arlington', currentState: 'VA',
    openToRelocation: false, travelWillingness: false, interimConsultingInterest: false, clearanceLevel: 'none',
  } as MatchCandidate
  const job: MatchJob = {
    title: 'Director, Data Engineering', description: 'Must hold an active TS/SCI. Python.', skills: ['python'], location: 'Chantilly, VA',
    level: 'DIRECTOR', industry: 'aerospace_defense', salaryMin: null, salaryMax: null, marketPayLow: null, marketPayMid: null,
    marketPayHigh: null, targetFunction: 'Engineering', targetLevel: null, targetRemotePolicy: null,
    requirementFlags: [{ flag: 'clearance', level: 'ts_sci', active: true, polygraph: null }], locationState: 'VA',
  }
  it('lists it first in the gaps and caps the overall', () => {
    const m = matchJobToCandidate(candidate, job)
    expect(m.requirements[0].status).toBe('blocker')
    expect(m.gaps[0]).toContain("Requires active TS/SCI — you told us you don't hold a clearance")
    expect(['weak', 'mixed']).toContain(m.overall)
    expect(m.overallScore === null || m.overallScore <= 44).toBe(true)
  })
  it('without the requirement answer, shows the flag neutrally and no gap', () => {
    const m = matchJobToCandidate({ ...candidate, clearanceLevel: null }, job)
    expect(m.requirements[0].status).toBe('unknown')
    expect(m.gaps.some((g) => g.includes('TS/SCI'))).toBe(false)
  })
  it('a job with no flags has no requirements', () => {
    expect(matchJobToCandidate(candidate, { ...job, requirementFlags: null }).requirements).toEqual([])
  })
})
