import { describe, expect, it } from 'vitest'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { FUNCTION_PROFILES, assessReason, buildPathway, costText, ownedFunctionsFrom } from '@/lib/journey/pathway'
import { assessIndustryMove } from '@/lib/journey/industry-feasibility'
import { deriveLearningPaths, markStepDone, nextStep, pathPercent, pathPlanItems, pathProgressOf } from '@/lib/journey/learning-paths'
import { buildTarget } from '@/lib/journey/pivot'

const now = new Date('2026-10-16T12:00:00Z')

describe('what would it take for a controller to become a designer', () => {
  const p = buildPathway('Finance', 'Design', { keywords: ['Excel', 'Figma basics'], seniorLevel: true })!
  it('says what they have, what they need, what it costs, how long, and what is hard', () => {
    expect(p.feasibility.tier).toBe('REBUILD')
    expect(p.have.join(' ')).toMatch(/analytical rigor/)
    expect(p.need.length).toBeGreaterThan(2)
    expect(p.months).toEqual([12, 36])
    expect(costText(p.cost.INFORMAL)).toMatch(/Up to \$1,500/)
    expect(costText(p.cost.FORMAL)).toMatch(/\$3,000 to \$20,000/)
    expect(p.challenges.length).toBeGreaterThan(1)
    expect(p.payNote).toMatch(/lower starting salary/)
    expect(p.proof).toMatch(/portfolio/)
  })
  it('counts skills already on the résumé as what they have, not what they need', () => {
    const has = buildPathway('Finance', 'Data & Analytics', { keywords: ['SQL', 'Tableau'] })!
    expect(has.have.join(' ')).toMatch(/SQL/)
    expect(has.need.join(' ')).not.toMatch(/\bSQL\b/)
  })
  it('a function they have already owned is a head start', () => {
    const owned = buildPathway('Finance', 'Marketing', { ownedFunctions: ownedFunctionsFrom(['MARKETING', 'IT']) })!
    expect(owned.headStart).toMatch(/already owned Marketing/)
    expect(owned.feasibility.tier).toBe('ADJACENT')
    expect(ownedFunctionsFrom(['HR', 'CUSTOMER_SUCCESS', 'IT'])).toEqual(['Human Resources', 'Customer Success'])
  })
  it('every function we send people to has a profile', () => {
    for (const fn of PRIMARY_FUNCTION_OPTIONS.filter((f) => !['General', 'Other', 'Executive Leadership'].includes(f))) expect(FUNCTION_PROFILES[fn], fn).toBeTruthy()
  })
})

describe('why do you like it', () => {
  it('suggests smaller changes that deliver the same thing, never blocks', () => {
    const r = assessReason('Finance', 'Design', 'creative')
    expect(r.alternatives.length).toBeGreaterThan(0)
    expect(r.alternatives.map((a) => a.label).join(' ')).toMatch(/Marketing|Product|more creative/)
  })
  it('says honestly when pay is the reason and the move is a rebuild', () => {
    expect(assessReason('Finance', 'Design', 'pay', { seniorLevel: true }).worth.map((w) => w.text).join(' ')).toMatch(/Pay usually drops first/)
  })
  it('asks whether it is the function or the employer when they want out', () => {
    const r = assessReason('Finance', 'Design', 'escape')
    expect(r.worth.map((w) => w.text).join(' ')).toMatch(/function, not the employer/)
    expect(r.alternatives.map((a) => a.label).join(' ')).toMatch(/Change employer or industry/)
  })
  it('suggests nothing closer when the ask is already a natural move', () => {
    expect(assessReason('Finance', 'Operations', 'creative').alternatives.some((a) => a.tier === 'SAME')).toBe(false)
  })
})

describe('moving industries', () => {
  it('your function carries over into an unregulated industry', () => {
    expect(assessIndustryMove('SaaS software', 'Retail', 'Finance').tier).toBe('EASY')
  })
  it('a portable function needs the rules learned for a regulated industry', () => {
    const m = assessIndustryMove('Software', 'Healthcare', 'Finance')
    expect(m.tier).toBe('DOMAIN')
    expect(m.learn.join(' ')).toMatch(/HIPAA/)
  })
  it('a domain-heavy function in a regulated industry is a bigger step', () => {
    expect(assessIndustryMove('Software', 'Pharmaceuticals and biotech', 'Marketing').tier).toBe('REGULATED')
  })
  it('having worked there before makes it easy', () => {
    expect(assessIndustryMove('Software', 'Healthcare', 'Marketing', { sectorHistory: ['HEALTHCARE'] }).tier).toBe('EASY')
  })
  it('same industry is nothing to bridge', () => {
    expect(assessIndustryMove('Healthcare', 'Healthcare', 'Marketing').tier).toBe('SAME')
  })
})

describe('learning paths are tied to a goal', () => {
  const committed = buildTarget('Finance', 'Design', { route: 'FORMAL', hoursPerWeek: 5, commit: true }, now)
  const exploring = buildTarget('Finance', 'Engineering', {}, now)
  const input = {
    from: 'Finance',
    pivot: { targets: [committed, exploring], updatedAt: '' },
    career: { nextLevel: 'Director', focus: 'level' as const, intent: 'stay' as const },
    skillsToBuild: ['data_storytelling'],
    aiJobLoss: true,
    boardInterest: true,
  }
  const paths = deriveLearningPaths(input)
  it('each path names the goal it serves and whether they said it or we inferred it', () => {
    for (const p of paths) {
      expect(p.goal.length, p.id).toBeGreaterThan(5)
      expect(p.because.length, p.id).toBeGreaterThan(10)
      expect(['expressed', 'implied']).toContain(p.source)
      expect(p.steps.length, p.id).toBeGreaterThan(1)
    }
    expect(paths.find((p) => p.id === 'pivot-design')!.goal).toBe('Move into Design')
    expect(paths.find((p) => p.id === 'ai-outlook')!.source).toBe('implied')
  })
  it('a change they have not committed to gets a cheap test, not a training plan', () => {
    const t = paths.find((p) => p.id === 'pivot-engineering')!
    expect(t.title).toMatch(/Test Engineering cheaply/)
  })
  it('there can be several, never more than five', () => {
    expect(paths.length).toBeGreaterThan(2)
    expect(paths.length).toBeLessThanOrEqual(5)
    expect(new Set(paths.map((p) => p.id)).size).toBe(paths.length)
  })
  it('progress is kept and the plan shows the next step of at most two paths', () => {
    let progress = pathProgressOf({})
    const items = pathPlanItems(paths, progress)
    expect(items.length).toBeLessThanOrEqual(2)
    const first = paths.find((p) => p.id === 'pivot-design')!
    progress = markStepDone(progress, paths, first.id, first.steps[0].id)!
    expect(nextStep(first, progress)?.id).toBe(first.steps[1].id)
    expect(pathPercent(first, progress)).toBeGreaterThan(0)
    expect(markStepDone(progress, paths, first.id, 'nonsense')).toBeNull()
  })
  it('a member with no goals has no paths', () => {
    expect(deriveLearningPaths({ from: 'Finance', pivot: null, career: null, skillsToBuild: [], aiJobLoss: false, boardInterest: false })).toEqual([])
  })
})
