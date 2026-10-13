import { describe, expect, it } from 'vitest'
import { fundingPathway, PATHWAY_NOTE } from '@/lib/funding-opportunities/pathways'
import { classifyGrant } from '@/lib/funding-opportunities/eligibility'
import { GRANT_KEYWORDS, isRelevant, titleScore } from '@/lib/funding-opportunities/relevance'
import { FOUNDATIONS } from '@/lib/funding-opportunities/foundations'

describe('fundingPathway', () => {
  it('names Workforce Pell notices', () => {
    expect(fundingPathway('Workforce Pell Program Approval Guidance')).toBe('WORKFORCE_PELL')
    expect(fundingPathway('Short-term Pell data capacity for community colleges')).toBe('WORKFORCE_PELL')
  })
  it('names AI workforce notices, before dislocated worker', () => {
    expect(fundingPathway('Rapid Reskill Employment Recovery National Dislocated Worker Grants')).toBe('AI_WORKFORCE')
    expect(fundingPathway('AI Literacy and Skills Training for Workers')).toBe('AI_WORKFORCE')
  })
  it('names dislocated worker notices', () => {
    expect(fundingPathway('National Dislocated Worker Grant Program')).toBe('DISLOCATED_WORKER')
    expect(fundingPathway('Rapid Response and layoff aversion')).toBe('DISLOCATED_WORKER')
  })
  it('leaves unrelated notices alone', () => {
    expect(fundingPathway('Fish hatchery maintenance')).toBeNull()
    expect(fundingPathway('Artificial intelligence for crop imaging')).toBeNull()
    expect(fundingPathway('Maintenance of paid leave rules')).toBeNull()
  })
})

describe('VIA_PARTNER explanation', () => {
  it('adds the Texas pattern for Workforce Pell, keeping the vendor/subrecipient line', () => {
    const r = classifyGrant(['06'], '', 'Workforce Pell capacity grant')
    expect(r.eligibility).toBe('VIA_PARTNER')
    expect(r.note).toMatch(/vendor or subrecipient/)
    expect(r.note).toContain(PATHWAY_NOTE.WORKFORCE_PELL)
    expect(r.note).toMatch(/Texas pattern/)
    expect(r.note).toMatch(/professional-track provider/)
  })
  it('adds the pattern for the DOL dislocated worker and AI grants', () => {
    expect(classifyGrant(['00'], '', 'National Dislocated Worker Grant').note).toContain(PATHWAY_NOTE.DISLOCATED_WORKER)
    expect(classifyGrant(['00'], '', 'Rapid Reskill Employment Recovery NDWG').note).toContain(PATHWAY_NOTE.AI_WORKFORCE)
  })
  it('leaves other partner notes and non-partner results unchanged', () => {
    expect(classifyGrant(['06'], '', 'Career services for veterans').note).not.toMatch(/Texas/)
    expect(classifyGrant(['22'], '', 'Workforce Pell capacity grant').note).not.toMatch(/Texas/)
    expect(classifyGrant(['06'], '').note).not.toMatch(/Texas/)
  })
})

describe('matching Workforce Pell and AI workforce notices', () => {
  it('searches for them by name', () => {
    for (const k of ['workforce pell', 'rapid reskill', 'AI workforce']) expect(GRANT_KEYWORDS).toContain(k)
  })
  it('scores their titles as relevant for any issuer', () => {
    expect(titleScore('Workforce Pell Grant Implementation')).toBeGreaterThanOrEqual(4)
    expect(isRelevant({ title: 'Building Local Capacity for Workforce Pell Data', agencyCode: 'ED' })).toBe(true)
    expect(isRelevant({ title: 'AI Workforce Training Partnerships', agencyCode: 'NSF' })).toBe(true)
  })
  it('does not admit AI research that is not about workers', () => {
    expect(isRelevant({ title: 'Artificial Intelligence for Protein Folding', agencyCode: 'NIH' })).toBe(false)
  })
})

describe('foundation seed list', () => {
  it('has only VERIFIED or TO VERIFY and a checked date and source for every entry', () => {
    expect(FOUNDATIONS.length).toBeGreaterThanOrEqual(10)
    for (const f of FOUNDATIONS) {
      expect(['VERIFIED', 'TO VERIFY']).toContain(f.status)
      expect(f.dateChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(f.sourceUrl).toMatch(/^https:\/\//)
    }
  })
  it('never calls a foundation VERIFIED when its for-profit eligibility is unknown', () => {
    for (const f of FOUNDATIONS.filter((x) => x.status === 'VERIFIED')) expect(f.forProfit).not.toBe('UNKNOWN')
  })
  it('includes the named starting four', () => {
    const names = FOUNDATIONS.map((f) => f.name).join(' | ')
    for (const n of ['Lumina', 'Strada', 'Markle', 'Walmart']) expect(names).toContain(n)
  })
})
