import { describe, it, expect } from 'vitest'
import { buildCorpusMeans, cosine, centeredVector, elementWeight, occupationSimilarity } from '@/lib/occupations/similarity'
import { skillsFit, toolsFit, targetTools } from '@/lib/occupations/skills-fit'
import { payDifference, pivotPaths } from '@/lib/occupations/pivot-paths'
import {
  ALL_OCCUPATIONS, TARGET_OCCUPATIONS, MARKETING_MANAGERS, SALES_MANAGERS, FINANCIAL_MANAGERS, FINANCIAL_ANALYSTS,
  DATA_SCIENTISTS, HR_MANAGERS, SPARSE_TOOLS_OCCUPATION, FOOD_SERVICE_MANAGERS, MARKET_RESEARCH_ANALYSTS,
} from './fixtures/occupations-sample'

const means = buildCorpusMeans(TARGET_OCCUPATIONS)
const sim = (a: Parameters<typeof occupationSimilarity>[0], b: Parameters<typeof occupationSimilarity>[1]) =>
  occupationSimilarity(a, b, means)

describe('similarity', () => {
  it('weights importance times level, clamped to range', () => {
    expect(elementWeight({ importance: 5, level: 7 })).toBe(1)
    expect(elementWeight({ importance: 2.5, level: 3.5 })).toBeCloseTo(0.25)
    expect(elementWeight({ importance: 9, level: 99 })).toBe(1)
  })
  it('scores an occupation against itself as 1 and ignores a zero vector', () => {
    expect(sim(MARKETING_MANAGERS, MARKETING_MANAGERS)).toBeCloseTo(1)
    expect(cosine(new Map(), centeredVector(MARKETING_MANAGERS, means))).toBe(0)
  })
  it('puts related occupations closer than unrelated ones', () => {
    expect(sim(MARKETING_MANAGERS, SALES_MANAGERS)).toBeGreaterThan(sim(MARKETING_MANAGERS, DATA_SCIENTISTS))
    expect(sim(FINANCIAL_MANAGERS, FINANCIAL_ANALYSTS)).toBeGreaterThan(sim(FINANCIAL_MANAGERS, SALES_MANAGERS))
    expect(sim(MARKETING_MANAGERS, MARKET_RESEARCH_ANALYSTS)).toBeGreaterThan(sim(MARKETING_MANAGERS, HR_MANAGERS))
  })
  it('centres on the corpus, so the shared generic core does not inflate unrelated roles', () => {
    const raw = (o: typeof MARKETING_MANAGERS) => new Map(o.elements.map((e) => [`${e.kind}:${e.elementId}`, elementWeight(e)]))
    const uncentred = cosine(raw(MARKETING_MANAGERS), raw(DATA_SCIENTISTS))
    expect(sim(MARKETING_MANAGERS, DATA_SCIENTISTS)).toBeLessThan(uncentred)
  })
})

describe('toolsFit', () => {
  it('lists hot technologies first and matches what the member shows', () => {
    expect(targetTools(DATA_SCIENTISTS).slice(0, 3).sort()).toEqual(['Python', 'R', 'SQL'])
    const fit = toolsFit(['python', 'sql', 'excel'], DATA_SCIENTISTS)
    expect(fit.have.sort()).toEqual(['Python', 'SQL'])
    expect(fit.missing).toEqual(expect.arrayContaining(['R', 'Tableau', 'Snowflake']))
    expect(fit.coveragePct).toBe(40)
  })
  it('matches a one-letter tool only on an exact keyword, never inside another', () => {
    expect(toolsFit(['excel', 'forecasting', 'r&d'], DATA_SCIENTISTS).have).not.toContain('R')
    expect(toolsFit(['R', 'python'], DATA_SCIENTISTS).have).toContain('R')
  })
  it('judges nothing when the target lists too few tools', () => {
    expect(toolsFit(['westlaw'], SPARSE_TOOLS_OCCUPATION)).toEqual({ requested: [], have: [], missing: [], coveragePct: null })
  })
})

describe('skillsFit', () => {
  const keywords = ['hubspot', 'salesforce', 'excel', 'google analytics']

  it('combines transferability and tools when both are known', () => {
    const fit = skillsFit({ current: MARKETING_MANAGERS, memberKeywords: keywords, target: SALES_MANAGERS, means })
    expect(fit.basis).toBe('occupation_and_tools')
    expect(fit.tools.coveragePct).toBe(75) // Salesforce, HubSpot, Excel shown; PowerPoint not
    expect(fit.tools.missing).toEqual(['Microsoft PowerPoint'])
    expect(fit.score).toBe(Math.round(0.6 * fit.transferability! + 0.4 * 75))
  })
  it('scores a closer move higher than a far one for the same member', () => {
    const near = skillsFit({ current: MARKETING_MANAGERS, memberKeywords: keywords, target: SALES_MANAGERS, means })
    const far = skillsFit({ current: MARKETING_MANAGERS, memberKeywords: keywords, target: DATA_SCIENTISTS, means })
    expect(near.score!).toBeGreaterThan(far.score!)
  })
  it('names the skills the target needs that the member occupation lacks', () => {
    const fit = skillsFit({ current: MARKETING_MANAGERS, memberKeywords: keywords, target: DATA_SCIENTISTS, means })
    const names = fit.gaps.map((g) => g.name)
    expect(names).toEqual(expect.arrayContaining(['Programming', 'Computers and electronics']))
    expect(fit.gaps.length).toBeLessThanOrEqual(6)
    for (const g of fit.gaps) expect(g.targetWeight - g.currentWeight).toBeGreaterThanOrEqual(0.15)
  })
  it('claims no gaps and no transferability without a current occupation', () => {
    const fit = skillsFit({ current: null, memberKeywords: ['python'], target: DATA_SCIENTISTS, means })
    expect(fit.gaps).toEqual([])
    expect(fit.transferability).toBeNull()
    expect(fit.basis).toBe('tools_only')
    expect(fit.score).toBe(fit.tools.coveragePct)
  })
  it('uses occupation alone when the target lists too few tools', () => {
    const fit = skillsFit({ current: MARKETING_MANAGERS, memberKeywords: [], target: SPARSE_TOOLS_OCCUPATION, means })
    expect(fit.basis).toBe('occupation_only')
    expect(fit.score).toBe(fit.transferability)
  })
  it('returns no score when neither signal is available', () => {
    const fit = skillsFit({ current: null, memberKeywords: [], target: SPARSE_TOOLS_OCCUPATION, means })
    expect(fit).toMatchObject({ score: null, basis: 'none', transferability: null })
  })
})

describe('payDifference', () => {
  const pay = (socCode: string, medianWage: number | null, topCoded = false) => ({ socCode, medianWage, topCoded })
  it('gives the whole-percent change in median pay', () => {
    expect(payDifference(pay('a', 100_000), pay('b', 125_000))).toEqual({ fromMedian: 100_000, toMedian: 125_000, changePct: 25 })
    expect(payDifference(pay('a', 100_000), pay('b', 90_000))?.changePct).toBe(-10)
  })
  it('shows nothing when either side is top-coded or missing', () => {
    expect(payDifference(pay('a', 100_000), pay('b', 239_200, true))).toBeNull()
    expect(payDifference(pay('a', 239_200, true), pay('b', 100_000))).toBeNull()
    expect(payDifference(pay('a', null), pay('b', 100_000))).toBeNull()
    expect(payDifference(undefined, pay('b', 100_000))).toBeNull()
  })
})

describe('pivotPaths', () => {
  const keywords = ['hubspot', 'salesforce', 'excel', 'google analytics']
  const base = { current: MARKETING_MANAGERS, memberKeywords: keywords, means }

  it('ranks in-scope occupations by fit and leaves out the member own and out-of-scope ones', () => {
    const paths = pivotPaths({ ...base, candidates: ALL_OCCUPATIONS, minScore: 0 })
    const titles = paths.map((p) => p.target.title)
    expect(titles).not.toContain(MARKETING_MANAGERS.title)
    expect(titles).not.toContain(FOOD_SERVICE_MANAGERS.title)
    expect(titles).not.toContain('Secretaries and Administrative Assistants')
    const scores = paths.map((p) => p.fit.score!)
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
    expect(titles.indexOf('Sales Managers')).toBeLessThan(titles.indexOf('Data Scientists'))
  })
  it('drops paths below the minimum score and honours the limit', () => {
    const all = pivotPaths({ ...base, candidates: ALL_OCCUPATIONS, minScore: 0 })
    expect(pivotPaths({ ...base, candidates: ALL_OCCUPATIONS, minScore: 0, limit: 2 })).toHaveLength(2)
    const cut = Math.max(...all.map((p) => p.fit.score!)) + 1
    expect(pivotPaths({ ...base, candidates: ALL_OCCUPATIONS, minScore: cut })).toEqual([])
  })
  it('attaches pay and outlook by SOC, and withholds pay involving a top-coded figure', () => {
    const pay = new Map([
      [MARKETING_MANAGERS.socCode, { socCode: MARKETING_MANAGERS.socCode, medianWage: 160_000, topCoded: false }],
      [SALES_MANAGERS.socCode, { socCode: SALES_MANAGERS.socCode, medianWage: 176_000, topCoded: false }],
      [FINANCIAL_MANAGERS.socCode, { socCode: FINANCIAL_MANAGERS.socCode, medianWage: 239_200, topCoded: true }],
    ])
    const outlook = new Map([[SALES_MANAGERS.socCode, { socCode: SALES_MANAGERS.socCode, changePct: 4, annualOpenings: 31_000 }]])
    const paths = pivotPaths({ ...base, candidates: ALL_OCCUPATIONS, minScore: 0, pay, outlook })
    const sales = paths.find((p) => p.target.title === 'Sales Managers')!
    expect(sales.pay?.changePct).toBe(10)
    expect(sales.targetPay?.medianWage).toBe(176_000)
    expect(paths.find((p) => p.target.title === 'Financial Managers')!.targetPay?.topCoded).toBe(true)
    expect(sales.outlook?.annualOpenings).toBe(31_000)
    expect(paths.find((p) => p.target.title === 'Financial Managers')!.pay).toBeNull()
    expect(paths.find((p) => p.target.title === 'Data Scientists')!.outlook).toBeNull()
  })
  it('breaks a score tie in favour of an occupation O*NET lists as related', () => {
    const twin = { ...HR_MANAGERS, onetSocCode: '11-3122.00', socCode: '11-3122', title: 'Compensation Managers' }
    const related = new Set([twin.onetSocCode])
    const paths = pivotPaths({ ...base, candidates: [HR_MANAGERS, twin], minScore: 0, relatedOnetSocCodes: related })
    expect(paths[0].fit.score).toBe(paths[1].fit.score)
    expect(paths[0].target.title).toBe('Compensation Managers')
    expect(paths[0].onetRelated).toBe(true)
  })
})
