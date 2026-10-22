import { describe, expect, it } from 'vitest'
import { aiPaySentence, aiShareSentence, aiTrainingWhy, learnWhyFirst } from '@/lib/redesign/learn-exposure-why'
import { RETRAINING_LINE, bandOf, type OccupationExposure } from '@/lib/skills/ai-exposure'
import type { AiMarketData } from '@/lib/skills/ai-market'

const occ = (score: number): OccupationExposure => ({ soc6: '11-1021', title: 'General and Operations Managers', score, band: bandOf(score) })
const BANNED = /\b(safe|risk|replaced|will lose)\b/i

describe('learnWhyFirst', () => {
  it('build_now: retraining line, exposure, openings and pay', () => {
    const w = learnWhyFirst({ exposure: occ(0.4), shareLine: '31% of x', payLine: 'pays more' })
    expect(w.need).toBe('build_now')
    expect(w.lead).toBe(RETRAINING_LINE.build_now)
    expect(w.facts).toHaveLength(3)
    expect(w.showCredit).toBe(true)
  })
  it('build_alongside drops missing facts', () => {
    const w = learnWhyFirst({ exposure: occ(0.14), shareLine: null, payLine: null })
    expect(w.need).toBe('build_alongside')
    expect(w.facts).toHaveLength(1)
  })
  it('optional says so and does not force an AI course', () => {
    const w = learnWhyFirst({ exposure: occ(0.02), shareLine: 'ignored', payLine: 'ignored' })
    expect(w.lead).toBe(RETRAINING_LINE.optional)
    expect(w.facts.join(' ')).toContain('do not put an AI course first')
    expect(w.facts.join(' ')).not.toContain('ignored')
  })
  it('unknown says we have no measure, with no credit', () => {
    const w = learnWhyFirst({ exposure: null, shareLine: 'x', payLine: 'y' })
    expect(w).toMatchObject({ need: 'unknown', lead: RETRAINING_LINE.unknown, facts: [], showCredit: false })
  })
  it('never uses the banned words', () => {
    for (const s of [0, 0.14, 0.4]) {
      const w = learnWhyFirst({ exposure: occ(s), shareLine: null, payLine: null })
      expect([w.lead, ...w.facts, w.footnote ?? ''].join(' ')).not.toMatch(BANNED)
    }
  })
})

describe('aiTrainingWhy', () => {
  it('replaces the market line when measured', () => {
    const t = aiTrainingWhy(occ(0.4), 'OLD LINE')
    expect(t).toContain(RETRAINING_LINE.build_now)
    expect(t).not.toContain('OLD LINE')
  })
  it('keeps the old line when not measured', () => {
    expect(aiTrainingWhy(null, 'OLD LINE')).toBe(`${RETRAINING_LINE.unknown} OLD LINE`)
  })
})

describe('posting facts', () => {
  const live = { asOf: '2026-10-16', functions: { finance: { label: 'Finance', n: 500, sharePct: 31.4 }, hr: { label: 'HR', n: 50, sharePct: 10 } } } as unknown as AiMarketData
  it('states the share of openings', () => {
    expect(aiShareSentence('finance', live)).toBe('31% of Finance openings on our board ask for a specific AI skill.')
  })
  it('is null for a thin function or no data', () => {
    expect(aiShareSentence('hr', live)).toBeNull()
    expect(aiShareSentence('finance', null)).toBeNull()
  })
  it('pay sentence is null without a note', () => {
    expect(aiPaySentence(null)).toBeNull()
    expect(aiPaySentence({ fnLabel: 'Finance', phrase: 'posted pay is higher', asOf: '2026-10-16' })).toContain('Finance openings ask for an AI skill, posted pay is higher.')
  })
})
