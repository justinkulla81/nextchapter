import { describe, expect, it } from 'vitest'
import { isGenericTool, jobToolIds, keywordMatch, keywordMatchLabel, MIN_KEYWORDS_FOR_SCORE } from '@/lib/jobs/keyword-match'

const names = new Map([
  ['tech:salesforce-software', 'Salesforce software'],
  ['tech:microsoft-excel', 'Microsoft Excel'],
  ['tech:oracle-netsuite', 'Oracle NetSuite'],
  ['tech:hubspot-software', 'HubSpot software'],
])

describe('keywordMatch', () => {
  const jobText = 'VP Finance. You will own FP&A, budgeting and forecasting in NetSuite and Microsoft Excel, and build dashboards in Tableau.'

  it('scores the share of the job keywords the resume shows, with matched and missing lists', () => {
    const m = keywordMatch({ jobText, memberKeywords: ['FP&A', 'Budgeting', 'Excel'], memberSkillIds: new Set(), skillNames: names })
    expect(m.matched).toEqual(expect.arrayContaining(['fp&a', 'budgeting', 'excel']))
    expect(m.missing).toEqual(expect.arrayContaining(['netsuite', 'forecasting', 'tableau']))
    expect(m.score).toBe(Math.round((100 * m.matched.length) / (m.matched.length + m.missing.length)))
  })

  it('shows a tool found both in the vocabulary and in O*NET once, by the vocabulary name', () => {
    const m = keywordMatch({ jobText, memberKeywords: [], memberSkillIds: new Set(), skillNames: names })
    const all = [...m.matched, ...m.missing].map((s) => s.toLowerCase())
    expect(all.filter((s) => s.includes('excel'))).toHaveLength(1)
    expect(all.filter((s) => s.includes('netsuite'))).toHaveLength(1)
  })

  it('credits a tool the member evidences through the alias layer (SkillAlias ids)', () => {
    const m = keywordMatch({
      jobText: 'Sales ops lead. Run HubSpot and the forecast.',
      jobSkillIds: ['tech:salesforce-software'],
      memberKeywords: ['sfdc admin'],
      memberSkillIds: new Set(['tech:salesforce-software']),
      skillNames: names,
    })
    expect(m.matched).toContain('Salesforce software')
    expect(m.missing).toContain('hubspot')
  })

  it('uses the posting stored skills over a rescan of the text, and its stored tool ids', () => {
    expect(jobToolIds({ jobText: 'Uses Microsoft Excel', jobSkillIds: ['tech:oracle-netsuite'] })).toEqual(new Set(['tech:oracle-netsuite', 'tech:microsoft-excel']))
    const m = keywordMatch({ jobText: 'anything', jobSkills: ['sql', 'python', 'tableau'], memberKeywords: ['Python'], memberSkillIds: new Set(), skillNames: names })
    expect(m.matched).toEqual(['python'])
    expect(m.missing).toEqual(['sql', 'tableau'])
    expect(m.score).toBe(33)
  })

  it('matches whole words only', () => {
    const m = keywordMatch({ jobText: 'Must know SQL, Python and Excel.', memberKeywords: ['sqlite', 'excellent communicator'], memberSkillIds: new Set(), skillNames: new Map() })
    expect(m.matched).toEqual([])
  })

  it('gives no score when the job names too few keywords, and never fails on empty text', () => {
    const m = keywordMatch({ jobText: 'Great job using Excel.', memberKeywords: ['excel'], memberSkillIds: new Set(), skillNames: new Map() })
    expect(m.matched.length + m.missing.length).toBeLessThan(MIN_KEYWORDS_FOR_SCORE)
    expect(m.score).toBeNull()
    expect(keywordMatch({ jobText: null, memberKeywords: [], memberSkillIds: new Set(), skillNames: names })).toEqual({ score: null, matched: [], missing: [] })
  })

  it('skips O*NET software categories a generic phrase triggers, keeps named products', () => {
    for (const n of ['Retirement planning software', 'Workflow software', 'Database software', 'Financial planning software', 'Software libraries', 'Microservices architecture']) expect(isGenericTool(n)).toBe(true)
    for (const n of ['Salesforce software', 'HubSpot software', 'Microsoft Excel', 'Oracle NetSuite', 'Kubernetes']) expect(isGenericTool(n)).toBe(false)
    const m = keywordMatch({ jobText: 'Leasing consultant. Excel.', jobSkillIds: ['tech:retirement-planning-software'], memberKeywords: [], memberSkillIds: new Set(), skillNames: new Map([['tech:retirement-planning-software', 'Retirement planning software']]) })
    expect(m.missing).toEqual(['excel'])
  })

  it('labels the score in plain words', () => {
    expect(keywordMatchLabel(80)).toBe('Strong match')
    expect(keywordMatchLabel(50)).toBe('Partial match')
    expect(keywordMatchLabel(10)).toBe('Weak match')
  })
})
