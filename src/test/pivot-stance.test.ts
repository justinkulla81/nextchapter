import { describe, expect, it } from 'vitest'
import { activeTargets, buildTarget, mergeTarget, moveStance, pivotInterestsOf, pivotPlanItems, searchableTargets, stanceOf, type PivotDetails } from '@/lib/journey/pivot'
import { functionIdeas, industryIdeas, pivotIdeas, skillIdeas, stayAndShiftIdeas } from '@/lib/journey/pivot-ideas'
import { deriveLearningPaths } from '@/lib/journey/learning-paths'

const t0 = new Date('2026-03-02T12:00:00Z')
const t1 = new Date('2026-04-06T12:00:00Z')
const t2 = new Date('2026-06-01T12:00:00Z')

describe('thinking about a change is not a commitment', () => {
  const wondering = mergeTarget(undefined, buildTarget('Finance', 'Design', {}, t0), t0)

  it('a new idea starts on the radar, with the date they first told us', () => {
    expect(stanceOf(wondering)).toBe('WONDERING')
    expect(wondering.since).toBe(t0.toISOString())
    expect(wondering.history).toEqual([{ at: t0.toISOString(), stance: 'WONDERING' }])
  })
  it('a natural move reads as trying it out, not as a big decision', () => {
    expect(stanceOf(buildTarget('Finance', 'Operations', {}, t0))).toBe('TRYING')
  })
  it('keeps the story as they move, including how it feels', () => {
    const trying = moveStance(wondering, { stance: 'TRYING', feeling: 'SCARED' }, t1)
    const calmer = moveStance(trying, { feeling: 'CURIOUS', note: 'Talked to a designer. It was less scary.' }, t2)
    expect(stanceOf(calmer)).toBe('TRYING')
    expect(calmer.feeling).toBe('CURIOUS')
    expect(calmer.history!.map((h) => [h.stance, h.feeling])).toEqual([['WONDERING', undefined], ['TRYING', 'SCARED'], ['TRYING', 'CURIOUS']])
    expect(calmer.history![2].note).toMatch(/less scary/)
  })
  it('records nothing when nothing changed', () => {
    expect(moveStance(wondering, { stance: 'WONDERING' }, t1)).toBe(wondering)
  })
  it('cannot jump to getting ready without a route and hours', () => {
    expect(stanceOf(moveStance(wondering, { stance: 'PREPARING' }, t1))).toBe('WONDERING')
    expect(stanceOf(moveStance(wondering, { stance: 'GOING_FOR_IT' }, t1))).toBe('WONDERING')
  })
  it('setting it aside keeps it, stops searching for it, and it can come back', () => {
    const committed = mergeTarget(undefined, buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 5, commit: true }, t0), t0)
    expect(stanceOf(committed)).toBe('PREPARING')
    const aside = moveStance(committed, { stance: 'SET_ASIDE', note: 'Not the right year.' }, t1)
    const details: PivotDetails = { targets: [aside], updatedAt: '' }
    expect(stanceOf(aside)).toBe('SET_ASIDE')
    expect(searchableTargets(details)).toEqual([])
    expect(activeTargets(details)).toEqual([])
    expect(details.targets).toHaveLength(1)
    expect(deriveLearningPaths({ from: 'Finance', pivot: details, career: null, skillsToBuild: [], aiDisplaced: false, boardInterest: false })).toEqual([])
    const back = mergeTarget(aside, buildTarget('Finance', 'Design', {}, t2), t2)
    expect(stanceOf(back)).toBe('WONDERING')
    expect(back.since).toBe(t0.toISOString())
    expect(back.history!.length).toBeGreaterThan(aside.history!.length - 1)
  })
  it('unticking a commitment uncommits it', () => {
    const committed = mergeTarget(undefined, buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 5, commit: true }, t0), t0)
    const un = mergeTarget(committed, buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 5, commit: false }, t1), t1)
    expect(un.committedAt).toBeUndefined()
    expect(stanceOf(un)).toBe('WONDERING')
  })
  it('keeps the commit date when nothing about the commitment changed', () => {
    const c1 = mergeTarget(undefined, buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 5, commit: true }, t0), t0)
    const c2 = mergeTarget(c1, buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 5, commit: true }, t1), t1)
    expect(c2.committedAt).toBe(t0.toISOString())
  })
})

describe('the plan asks how it feels, gently and about once a month', () => {
  const week = 7 * 86_400_000
  let on = t0
  while (Math.floor(on.getTime() / week) % 4 !== 0) on = new Date(on.getTime() + week)
  const off = new Date(on.getTime() + week)
  const details: PivotDetails = {
    targets: [mergeTarget(undefined, buildTarget('Finance', 'Design', {}, t0), t0), moveStance(mergeTarget(undefined, buildTarget('Finance', 'Engineering', {}, t0), t0), { stance: 'TRYING' }, t0), moveStance(mergeTarget(undefined, buildTarget('Finance', 'Legal', {}, t0), t0), { stance: 'SET_ASIDE' }, t0)],
    updatedAt: '',
  }
  it('never tells a nervous person to commit or drop it', () => {
    const text = pivotPlanItems(details, on).map((i) => i.text).join(' | ')
    expect(text).toMatch(/wondering about Design/)
    expect(text).toMatch(/No decision needed/)
    expect(text).toMatch(/trying out Engineering/)
    expect(text).not.toMatch(/commit|take it off/i)
    expect(text).not.toMatch(/Legal/)
  })
  it('stays quiet in the other weeks', () => {
    expect(pivotPlanItems(details, off)).toEqual([])
  })
})

describe('ideas for people who do not know where to start', () => {
  const input = {
    from: 'Finance',
    keywords: ['Excel', 'SQL', 'forecasting'],
    ownedFunctions: [],
    seniorLevel: false,
    currentIndustry: 'Software company',
    sectorHistory: [],
    reason: null,
    onRadar: [],
    industriesOnRadar: [],
    skillsToBuild: [],
  }
  it('puts natural moves first and never suggests where they already are', () => {
    const fns = functionIdeas(input)
    expect(fns.length).toBeGreaterThan(1)
    expect(fns.some((f) => f.function === 'Finance')).toBe(false)
    expect(['ADJACENT', 'BRIDGE']).toContain(fns[0].tier)
    expect(fns.every((f) => f.why.length > 15 && f.smallestStep.length > 10)).toBe(true)
  })
  it('says what they already have when their résumé matches', () => {
    expect(functionIdeas(input).find((f) => f.function === 'Data & Analytics')?.why).toMatch(/already have/)
  })
  it('a function they have already run is a strong idea', () => {
    const fns = functionIdeas({ ...input, ownedFunctions: ['Marketing'] })
    expect(fns.map((f) => f.function)).toContain('Marketing')
    expect(fns.find((f) => f.function === 'Marketing')?.why).toMatch(/already run/)
  })
  it('does not repeat what is already on their radar', () => {
    expect(functionIdeas({ ...input, onRadar: ['Operations', 'Data & Analytics'] }).map((f) => f.function)).not.toContain('Operations')
  })
  it('suggests industries where their function travels, easiest first, with a first step', () => {
    const inds = industryIdeas(input)
    expect(inds.length).toBeGreaterThan(1)
    expect(inds[0].tier).toBe('EASY')
    expect(inds.every((i) => i.smallestStep.length > 10)).toBe(true)
    expect(inds.map((i) => i.industry)).not.toContain('Technology & Software') // where they are now
  })
  it('suggests skills that point to a reason, and skips ones they are already building', () => {
    const fns = functionIdeas(input)
    const skills = skillIdeas({ ...input, skillsToBuild: ['product_sense'] }, fns)
    expect(skills.length).toBeGreaterThan(0)
    expect(skills.every((s) => fns.some((f) => f.function === s.forFunction))).toBe(true)
  })
  it('offers changes that are not a change of function, because that is often what they want', () => {
    const shifts = stayAndShiftIdeas('escape', 'Finance')
    expect(shifts.map((s) => s.label).join(' ')).toMatch(/Change employer or industry|different industry/)
    expect(pivotIdeas(input).stayAndShift.length).toBe(3)
  })
  it('reads interests saved earlier', () => {
    expect(pivotInterestsOf({ pivotInterests: { industries: [{ name: 'Insurance', since: t0.toISOString() }, { nope: 1 }] } }).industries).toHaveLength(1)
    expect(pivotInterestsOf(null).industries).toEqual([])
  })
})
