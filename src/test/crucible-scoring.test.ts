// QA-judgment scoring (scoreQaSubmission) is pure/deterministic — same
// inputs always produce the same breakdown, no LLM involved. The two
// AI-graded activities (prompt-authoring, dataset-analysis) live in
// ai-grading.ts and are NOT unit-tested here since they make a real network
// call — combineCrucibleScores is tested instead, treating their resulting
// numeric scores as plain inputs (which is exactly how actions.ts uses it).
import { describe, it, expect } from 'vitest'
import { aiGradeTierPassed, combineCrucibleScores, qaTierPassed, scoreQaSubmission, SCORING_VERSION, CONTENT_VERSION } from '@/lib/crucible/scoring'
import type { CrucibleAiTools, CrucibleQaSubmission, CrucibleTiersReached } from '@/lib/crucible/scoring-types'

function qa(overrides: Partial<CrucibleQaSubmission>): CrucibleQaSubmission {
  return { selectedOptionIds: [], verdict: 'SHIP', ...overrides }
}

const VALID_AI_TOOLS: CrucibleAiTools = { tools: ['ChatGPT'], bestMove: 'Asked it to trace every db write in the diff' }
const ALL_MEDIUM: CrucibleTiersReached = { qa: 'MEDIUM', prompt: 'MEDIUM', dataset: 'MEDIUM' }

describe('scoreQaSubmission — CODE variant, MEDIUM tier', () => {
  it('defect selected + BLOCK earns full defect + verdict credit, herring stays calibrated by default', () => {
    const result = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'BLOCK' }))
    expect(result.defectDetection).toBe('exact')
    expect(result.defectPoints).toBe(60)
    expect(result.verdictPoints).toBe(25)
    expect(result.herringOutcome).toBe('calibrated')
    expect(result.herringPoints).toBe(5)
    expect(result.rawPoints).toBe(90)
  })

  it('defect found but SHIPPED anyway earns detection credit, not verdict credit', () => {
    const result = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'SHIP' }))
    expect(result.defectPoints).toBe(60)
    expect(result.verdictPoints).toBe(0)
  })

  it('SHIP_WITH_CONDITIONS earns verdict credit only when the defect was actually caught', () => {
    const withDefect = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'SHIP_WITH_CONDITIONS' }))
    expect(withDefect.verdictPoints).toBe(25)
    const withoutDefect = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: [], verdict: 'SHIP_WITH_CONDITIONS' }))
    expect(withoutDefect.verdictPoints).toBe(0)
  })

  it('selecting a distractor instead of the real defect earns zero defect credit', () => {
    const result = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_rounding'], verdict: 'BLOCK' }))
    expect(result.defectDetection).toBe('none')
    expect(result.defectPoints).toBe(0)
  })

  it('selecting the herring without blocking over it is merely ignored, not penalized', () => {
    const result = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved', 'code_console_log'], verdict: 'SHIP' }))
    expect(result.herringOutcome).toBe('ignored')
    expect(result.herringPoints).toBe(0)
  })

  it('selecting the herring AND blocking over it is overblocking — the calibration failure being measured', () => {
    const result = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved', 'code_console_log'], verdict: 'BLOCK' }))
    expect(result.herringOutcome).toBe('overblocked')
    expect(result.herringPoints).toBe(-10)
    expect(result.rawPoints).toBe(60 + 25 - 10)
  })

  it('nothing selected, SHIP verdict — worst case, raw points floor at herring-calibrated only', () => {
    const result = scoreQaSubmission('CODE', 'MEDIUM', qa({}))
    expect(result.rawPoints).toBe(5)
  })
})

describe('scoreQaSubmission — MARKETING and DATA use the same shape at MEDIUM', () => {
  it('MARKETING: selecting the fabricated-claim option + BLOCK', () => {
    const result = scoreQaSubmission('MARKETING', 'MEDIUM', qa({ selectedOptionIds: ['mktg_fabricated_claim'], verdict: 'BLOCK' }))
    expect(result.defectDetection).toBe('exact')
    expect(result.rawPoints).toBe(90)
  })

  it('DATA: selecting the headline-vs-table option + BLOCK', () => {
    const result = scoreQaSubmission('DATA', 'MEDIUM', qa({ selectedOptionIds: ['data_headline_contradicts_table'], verdict: 'BLOCK' }))
    expect(result.defectDetection).toBe('exact')
    expect(result.rawPoints).toBe(90)
  })
})

describe('scoreQaSubmission — EASY and HARD tiers are universal regardless of variant', () => {
  it('EASY: the same universal scenario scores correctly whether routed via CODE, MARKETING, or DATA', () => {
    for (const variant of ['CODE', 'MARKETING', 'DATA'] as const) {
      const result = scoreQaSubmission(variant, 'EASY', qa({ selectedOptionIds: ['qa_easy_date_equality'], verdict: 'BLOCK' }))
      expect(result.defectDetection).toBe('exact')
      expect(result.rawPoints).toBe(90)
    }
  })

  it('HARD: the same universal scenario scores correctly regardless of variant', () => {
    const result = scoreQaSubmission('MARKETING', 'HARD', qa({ selectedOptionIds: ['qa_hard_idempotency'], verdict: 'BLOCK' }))
    expect(result.defectDetection).toBe('exact')
    expect(result.rawPoints).toBe(90)
  })

  it("EASY and MEDIUM checklist ids don't leak into each other's scoring", () => {
    // A MEDIUM-tier id has no meaning against EASY content — no defect option
    // matches, so it scores as a miss rather than accidentally matching.
    const result = scoreQaSubmission('CODE', 'EASY', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'BLOCK' }))
    expect(result.defectDetection).toBe('none')
  })
})

describe('qaTierPassed', () => {
  it('passes only when the defect was caught exactly AND the verdict was correct', () => {
    const caughtAndBlocked = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'BLOCK' }))
    expect(qaTierPassed(caughtAndBlocked)).toBe(true)

    const caughtButShipped = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'SHIP' }))
    expect(qaTierPassed(caughtButShipped)).toBe(false)

    const blockedWithoutCatching = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: [], verdict: 'BLOCK' }))
    expect(qaTierPassed(blockedWithoutCatching)).toBe(false)
  })
})

describe('aiGradeTierPassed', () => {
  it('passes at 70 and above, fails below', () => {
    expect(aiGradeTierPassed(70)).toBe(true)
    expect(aiGradeTierPassed(100)).toBe(true)
    expect(aiGradeTierPassed(69)).toBe(false)
    expect(aiGradeTierPassed(0)).toBe(false)
  })
})

describe('combineCrucibleScores', () => {
  it('perfect QA + perfect AI-graded activities + driver bonus clamps at 100', () => {
    const perfectQa = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'BLOCK' }))
    const result = combineCrucibleScores(perfectQa, 100, 100, VALID_AI_TOOLS, ALL_MEDIUM)
    expect(result.score).toBe(100)
    expect(result.band).toBe('Blocked it cold')
    expect(result.branch).toBe('PASS')
  })

  it('worst case across all three activities, no bonus, scores 0', () => {
    const worstQa = scoreQaSubmission('CODE', 'MEDIUM', qa({}))
    // rawPoints=5 here (herring-calibrated only) is the true floor for a
    // SHIP verdict — combineCrucibleScores itself still clamps to 0 as a
    // defensive floor, exercised directly by feeding it a synthetic
    // zero-raw-points breakdown.
    const zeroQa = { ...worstQa, rawPoints: 0, defectPoints: 0, verdictPoints: 0, herringPoints: 0 }
    const result = combineCrucibleScores(zeroQa, 0, 0, null, { qa: 'EASY', prompt: 'EASY', dataset: 'EASY' })
    expect(result.score).toBe(0)
    expect(result.band).toBe('The glitch shipped')
    expect(result.branch).toBe('GROWTH')
  })

  it('weights QA 40%, prompt 30%, dataset 30%, then adds the flat driver bonus', () => {
    // rawPoints=65 (defect 60 + verdict 0 + herring-calibrated 5) → 65/90 =
    // 72.222...% → *0.4 = 28.888... ; prompt 0*0.3=0 ; dataset 0*0.3=0 →
    // 28.888... rounds to 29.
    const qaResult = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'SHIP' }))
    const result = combineCrucibleScores(qaResult, 0, 0, null, ALL_MEDIUM)
    expect(result.score).toBe(29)
    expect(result.branch).toBe('GROWTH')
  })

  it('breakdown reports the rounded weighted contribution of each AI-graded activity', () => {
    const qaResult = scoreQaSubmission('CODE', 'MEDIUM', qa({}))
    const result = combineCrucibleScores(qaResult, 83, 67, null, ALL_MEDIUM)
    expect(result.breakdown.promptPoints).toBe(Math.round(83 * 0.3))
    expect(result.breakdown.datasetPoints).toBe(Math.round(67 * 0.3))
  })

  it('driver bonus requires both a tool AND a non-empty description of how', () => {
    const qaResult = scoreQaSubmission('CODE', 'MEDIUM', qa({}))
    const withEmptyMove = combineCrucibleScores(qaResult, 0, 0, { tools: ['Claude'], bestMove: '' }, ALL_MEDIUM)
    expect(withEmptyMove.breakdown.driverBonusEarned).toBe(false)
    const withNoTools = combineCrucibleScores(qaResult, 0, 0, { tools: [], bestMove: 'traced it' }, ALL_MEDIUM)
    expect(withNoTools.breakdown.driverBonusEarned).toBe(false)
  })

  it('reports the tiers reached verbatim, independent of the numeric score', () => {
    const qaResult = scoreQaSubmission('CODE', 'HARD', qa({ selectedOptionIds: ['qa_hard_idempotency'], verdict: 'BLOCK' }))
    const tiersReached: CrucibleTiersReached = { qa: 'HARD', prompt: 'EASY', dataset: 'MEDIUM' }
    const result = combineCrucibleScores(qaResult, 40, 60, null, tiersReached)
    expect(result.tiersReached).toEqual(tiersReached)
  })

  it('is a pure function — identical inputs always produce an identical result (§11 determinism guarantee)', () => {
    const qaResult = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'BLOCK' }))
    const a = combineCrucibleScores(qaResult, 75, 60, VALID_AI_TOOLS, ALL_MEDIUM)
    const b = combineCrucibleScores(qaResult, 75, 60, VALID_AI_TOOLS, ALL_MEDIUM)
    expect(a).toEqual(b)
  })

  it('stamps the current scoring/content version on every result', () => {
    const qaResult = scoreQaSubmission('CODE', 'MEDIUM', qa({}))
    const result = combineCrucibleScores(qaResult, 0, 0, null, ALL_MEDIUM)
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
