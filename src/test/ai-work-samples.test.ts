import { describe, it, expect } from 'vitest'
import { AI_SAMPLE_SPECS, AI_SAMPLE_TYPES, aiSampleChecks, readAiDetails } from '@/lib/evidence/ai-work-samples'
import { aiSampleEvidencePoints, AI_SAMPLE_MAX_POINTS, computeEvidence, EVIDENCE_POINTS } from '@/lib/evidence/score'

const none = { completedReferences: 0, portfolioItems: 0, importedReviews: [], clientReviewRatings: [] }

describe('AI work-sample templates', () => {
  it('has three types, each with checks, exactly one "measured" check and three bullet templates', () => {
    expect(AI_SAMPLE_TYPES).toEqual(['ai_workflow', 'ai_policy', 'ai_rag_eval'])
    for (const t of AI_SAMPLE_TYPES) {
      expect(AI_SAMPLE_SPECS[t].checks.filter((c) => c.metric)).toHaveLength(1)
      expect(AI_SAMPLE_SPECS[t].bullets).toHaveLength(3)
    }
  })
  it('keeps only the type’s own fields, trimmed', () => {
    const d = readAiDetails('ai_policy', (k) => ({ framework: '  NIST AI RMF ', evalSize: '40', aiToolsUsed: 'x' })[k])
    expect(d).toEqual({ framework: 'NIST AI RMF' })
  })
})

describe('aiSampleChecks', () => {
  it('automation: tool, measured before/after, review step, flow', () => {
    const c = aiSampleChecks({
      sampleType: 'ai_workflow',
      aiToolsUsed: 'Copilot',
      beforeMetric: '6 hours a week',
      afterMetric: '1.5 hours',
      aiDetails: { reviewStep: 'I tie out to the ledger' },
    })!
    expect(c.hasMetric).toBe(true)
    expect(c.passed.map((p) => p.key)).toEqual(['tool', 'measured', 'review'])
    expect(c.missing.map((p) => p.key)).toEqual(['flow'])
  })
  it('a before/after with no number is not a measured result', () => {
    expect(aiSampleChecks({ sampleType: 'ai_workflow', beforeMetric: 'slow', afterMetric: 'fast' })!.hasMetric).toBe(false)
  })
  it('policy: framework, owners and metrics, controls, measured result', () => {
    const c = aiSampleChecks({
      sampleType: 'ai_policy',
      aiDetails: { framework: 'NIST AI RMF', owners: 'CFO', metrics: 'WAU', riskControls: 'no client data', result: '3 of 10 piloted' },
    })!
    expect(c.missing).toEqual([])
    expect(c.hasMetric).toBe(true)
  })
  it('RAG/eval: needs the repo link, an eval with numbers, and cost/latency', () => {
    const c = aiSampleChecks({
      sampleType: 'ai_rag_eval',
      externalUrl: 'https://github.com/x/y',
      aiDetails: { howToRun: 'README', evalSize: '40 questions', accuracy: '85%' },
    })!
    expect(c.passed.map((p) => p.key)).toEqual(['runs', 'measured'])
    expect(c.missing.map((p) => p.key)).toEqual(['cost'])
  })
  it('is null for other sample types', () => {
    expect(aiSampleChecks({ sampleType: 'case_study' })).toBeNull()
  })
})

describe('evidence score with AI work samples', () => {
  it('weights a measured result most', () => {
    const measuredOnly = aiSampleEvidencePoints({ hasMetric: true, checksPassed: 1 })
    const allButMetric = aiSampleEvidencePoints({ hasMetric: false, checksPassed: 3 })
    expect(measuredOnly).toBeGreaterThan(allButMetric)
    expect(aiSampleEvidencePoints({ hasMetric: true, checksPassed: 4 })).toBe(AI_SAMPLE_MAX_POINTS)
    expect(aiSampleEvidencePoints({ hasMetric: false, checksPassed: 0 })).toBe(EVIDENCE_POINTS.portfolio)
  })
  it('an AI sample counts as evidence and scores above a plain work sample', () => {
    const ai = computeEvidence({ ...none, aiSamples: [{ hasMetric: true, checksPassed: 4 }] })
    const plain = computeEvidence({ ...none, portfolioItems: 1 })
    expect(ai.hasEvidence).toBe(true)
    expect(ai.pieces).toBe(1)
    expect(ai.score).toBeGreaterThan(plain.score)
  })
  it('suggests an AI work sample with a measured result when that raises the score most', () => {
    expect(computeEvidence(none).nextStep).toMatch(/AI work sample with a measured result/)
  })
})
