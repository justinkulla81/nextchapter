// QA-judgment scoring (scoreQaSubmission) is pure/deterministic — same
// inputs always produce the same breakdown, no LLM involved. The two
// AI-graded activities (prompt-authoring, dataset-analysis) live in
// ai-grading.ts and are NOT unit-tested here since they make a real network
// call — combineCrucibleScores is tested instead, treating their resulting
// numeric scores as plain inputs (which is exactly how actions.ts uses it).
import { describe, it, expect } from 'vitest'
import { scoreQaSubmission, combineCrucibleScores, SCORING_VERSION, CONTENT_VERSION } from '@/lib/crucible/scoring'
import type { CrucibleAiTools, CrucibleQaSubmission } from '@/lib/crucible/scoring-types'

function qa(overrides: Partial<CrucibleQaSubmission>): CrucibleQaSubmission {
  return { selectedOptionIds: [], verdict: 'SHIP', ...overrides }
}

const VALID_AI_TOOLS: CrucibleAiTools = { tools: ['ChatGPT'], bestMove: 'Asked it to trace every db write in the diff' }

describe('scoreQaSubmission — CODE variant', () => {
  it('defect selected + BLOCK earns full defect + verdict credit, herring stays calibrated by default', () => {
    const result = scoreQaSubmission('CODE', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'BLOCK' }))
    expect(result.defectDetection).toBe('exact')
    expect(result.defectPoints).toBe(60)
    expect(result.verdictPoints).toBe(25)
    expect(result.herringOutcome).toBe('calibrated')
    expect(result.herringPoints).toBe(5)
    expect(result.rawPoints).toBe(90)
  })

  it('defect found but SHIPPED anyway earns detection credit, not verdict credit', () => {
    const result = scoreQaSubmission('CODE', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'SHIP' }))
    expect(result.defectPoints).toBe(60)
    expect(result.verdictPoints).toBe(0)
  })

  it('SHIP_WITH_CONDITIONS earns verdict credit only when the defect was actually caught', () => {
    const withDefect = scoreQaSubmission('CODE', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'SHIP_WITH_CONDITIONS' }))
    expect(withDefect.verdictPoints).toBe(25)
    const withoutDefect = scoreQaSubmission('CODE', qa({ selectedOptionIds: [], verdict: 'SHIP_WITH_CONDITIONS' }))
    expect(withoutDefect.verdictPoints).toBe(0)
  })

  it('selecting a distractor instead of the real defect earns zero defect credit', () => {
    const result = scoreQaSubmission('CODE', qa({ selectedOptionIds: ['code_rounding'], verdict: 'BLOCK' }))
    expect(result.defectDetection).toBe('none')
    expect(result.defectPoints).toBe(0)
  })

  it('selecting the herring without blocking over it is merely ignored, not penalized', () => {
    const result = scoreQaSubmission('CODE', qa({ selectedOptionIds: ['code_never_saved', 'code_console_log'], verdict: 'SHIP' }))
    expect(result.herringOutcome).toBe('ignored')
    expect(result.herringPoints).toBe(0)
  })

  it('selecting the herring AND blocking over it is overblocking — the calibration failure being measured', () => {
    const result = scoreQaSubmission('CODE', qa({ selectedOptionIds: ['code_never_saved', 'code_console_log'], verdict: 'BLOCK' }))
    expect(result.herringOutcome).toBe('overblocked')
    expect(result.herringPoints).toBe(-10)
    expect(result.rawPoints).toBe(60 + 25 - 10)
  })

  it('nothing selected, SHIP verdict — worst case, raw points floor at herring-calibrated only', () => {
    const result = scoreQaSubmission('CODE', qa({}))
    expect(result.rawPoints).toBe(5)
  })
})

describe('scoreQaSubmission — MARKETING and DATA use the same shape', () => {
  it('MARKETING: selecting the fabricated-claim option + BLOCK', () => {
    const result = scoreQaSubmission('MARKETING', qa({ selectedOptionIds: ['mktg_fabricated_claim'], verdict: 'BLOCK' }))
    expect(result.defectDetection).toBe('exact')
    expect(result.rawPoints).toBe(90)
  })

  it('DATA: selecting the headline-vs-table option + BLOCK', () => {
    const result = scoreQaSubmission('DATA', qa({ selectedOptionIds: ['data_headline_contradicts_table'], verdict: 'BLOCK' }))
    expect(result.defectDetection).toBe('exact')
    expect(result.rawPoints).toBe(90)
  })
})

describe('combineCrucibleScores', () => {
  it('perfect QA + perfect AI-graded activities + driver bonus clamps at 100', () => {
    const perfectQa = scoreQaSubmission('CODE', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'BLOCK' }))
    const result = combineCrucibleScores(perfectQa, 100, 100, VALID_AI_TOOLS)
    expect(result.score).toBe(100)
    expect(result.band).toBe('Blocked it cold')
    expect(result.branch).toBe('PASS')
  })

  it('worst case across all three activities, no bonus, scores 0', () => {
    const worstQa = scoreQaSubmission('CODE', qa({}))
    // rawPoints=5 here (herring-calibrated only) is the true floor for a
    // SHIP verdict — combineCrucibleScores itself still clamps to 0 as a
    // defensive floor, exercised directly by feeding it a synthetic
    // zero-raw-points breakdown.
    const zeroQa = { ...worstQa, rawPoints: 0, defectPoints: 0, verdictPoints: 0, herringPoints: 0 }
    const result = combineCrucibleScores(zeroQa, 0, 0, null)
    expect(result.score).toBe(0)
    expect(result.band).toBe('The glitch shipped')
    expect(result.branch).toBe('GROWTH')
  })

  it('weights QA 40%, prompt 30%, dataset 30%, then adds the flat driver bonus', () => {
    // rawPoints=65 (defect 60 + verdict 0 + herring-calibrated 5) → 65/90 =
    // 72.222...% → *0.4 = 28.888... ; prompt 0*0.3=0 ; dataset 0*0.3=0 →
    // 28.888... rounds to 29.
    const qaResult = scoreQaSubmission('CODE', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'SHIP' }))
    const result = combineCrucibleScores(qaResult, 0, 0, null)
    expect(result.score).toBe(29)
    expect(result.branch).toBe('GROWTH')
  })

  it('breakdown reports the rounded weighted contribution of each AI-graded activity', () => {
    const qaResult = scoreQaSubmission('CODE', qa({}))
    const result = combineCrucibleScores(qaResult, 83, 67, null)
    expect(result.breakdown.promptPoints).toBe(Math.round(83 * 0.3))
    expect(result.breakdown.datasetPoints).toBe(Math.round(67 * 0.3))
  })

  it('driver bonus requires both a tool AND a non-empty description of how', () => {
    const qaResult = scoreQaSubmission('CODE', qa({}))
    const withEmptyMove = combineCrucibleScores(qaResult, 0, 0, { tools: ['Claude'], bestMove: '' })
    expect(withEmptyMove.breakdown.driverBonusEarned).toBe(false)
    const withNoTools = combineCrucibleScores(qaResult, 0, 0, { tools: [], bestMove: 'traced it' })
    expect(withNoTools.breakdown.driverBonusEarned).toBe(false)
  })

  it('is a pure function — identical inputs always produce an identical result (§11 determinism guarantee)', () => {
    const qaResult = scoreQaSubmission('CODE', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'BLOCK' }))
    const a = combineCrucibleScores(qaResult, 75, 60, VALID_AI_TOOLS)
    const b = combineCrucibleScores(qaResult, 75, 60, VALID_AI_TOOLS)
    expect(a).toEqual(b)
  })

  it('stamps the current scoring/content version on every result', () => {
    const qaResult = scoreQaSubmission('CODE', qa({}))
    const result = combineCrucibleScores(qaResult, 0, 0, null)
    expect(result.scoringVersion).toBe(SCORING_VERSION)
    expect(result.contentVersion).toBe(CONTENT_VERSION)
  })
})

// §9: "resume never referenced in any scoring code path (enforced by test)"
describe('scoring purity — no resume reference anywhere in the scoring module', () => {
  it('the scoring engine source contains no mention of resume', async () => {
    const fs = await import('node:fs/promises')
    const scoringSource = await fs.readFile(new URL('../lib/crucible/scoring.ts', import.meta.url), 'utf-8')
    const typesSource = await fs.readFile(new URL('../lib/crucible/scoring-types.ts', import.meta.url), 'utf-8')
    expect(scoringSource.toLowerCase()).not.toContain('resume')
    expect(typesSource.toLowerCase()).not.toContain('resume')
  })
})
