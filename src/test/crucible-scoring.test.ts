// QA-judgment scoring (scoreQaSubmission) is pure/deterministic — same
// inputs always produce the same breakdown, no LLM involved. The two
// AI-graded activities (prompt-authoring, dataset-analysis) live in
// ai-grading.ts and are NOT unit-tested here since they make a real network
// call — combineCrucibleScores is tested instead, treating their resulting
// numeric scores as plain inputs (which is exactly how actions.ts uses it).
import { describe, it, expect } from 'vitest'
import { aiGradeTierPassed, combineCrucibleScores, qaTierPassed, scoreQaSubmission, SCORING_VERSION, CONTENT_VERSION } from '@/lib/crucible/scoring'
import { getQaContent } from '@/lib/crucible/variants'
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

// Every variant now has genuinely distinct content at every tier (only
// CODE ever asks a candidate to review actual code) — previously EASY/HARD
// were one shared CODE-flavored scenario regardless of discipline. Each
// variant's own real defect id from variants.ts scores correctly at both
// tiers, and a different variant's id has no meaning against content it
// wasn't written for.
describe('scoreQaSubmission — every variant has distinct EASY/HARD content', () => {
  const EASY_DEFECT_ID: Record<'CODE' | 'MARKETING' | 'DATA' | 'DESIGN' | 'BUSINESS', string> = {
    CODE: 'qa_easy_date_equality',
    MARKETING: 'mktg_easy_stacking_claim',
    DATA: 'data_easy_promo_zero_miscount',
    DESIGN: 'design_easy_contrast',
    BUSINESS: 'biz_easy_migration_fee_ignored',
  }
  const HARD_DEFECT_ID: Record<'CODE' | 'MARKETING' | 'DATA' | 'DESIGN' | 'BUSINESS', string> = {
    CODE: 'qa_hard_idempotency',
    MARKETING: 'mktg_hard_charge_contradiction',
    DATA: 'data_hard_loyalty_threshold_conflict',
    DESIGN: 'design_hard_identical_avatars',
    BUSINESS: 'biz_hard_liability_cap_mismatch',
  }

  it('EASY: each variant\'s own real defect id scores exact', () => {
    for (const [variant, defectId] of Object.entries(EASY_DEFECT_ID) as [keyof typeof EASY_DEFECT_ID, string][]) {
      const result = scoreQaSubmission(variant, 'EASY', qa({ selectedOptionIds: [defectId], verdict: 'BLOCK' }))
      expect(result.defectDetection, `EASY/${variant}`).toBe('exact')
      expect(result.rawPoints, `EASY/${variant}`).toBe(90)
    }
  })

  it('HARD: each variant\'s own real defect id scores exact', () => {
    for (const [variant, defectId] of Object.entries(HARD_DEFECT_ID) as [keyof typeof HARD_DEFECT_ID, string][]) {
      const result = scoreQaSubmission(variant, 'HARD', qa({ selectedOptionIds: [defectId], verdict: 'BLOCK' }))
      expect(result.defectDetection, `HARD/${variant}`).toBe('exact')
      expect(result.rawPoints, `HARD/${variant}`).toBe(90)
    }
  })

  it("a variant's own MEDIUM-tier id has no meaning against its EASY content", () => {
    // Cross-tier ids don't leak into each other's scoring — no defect option
    // matches, so it scores as a miss rather than accidentally matching.
    const result = scoreQaSubmission('CODE', 'EASY', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'BLOCK' }))
    expect(result.defectDetection).toBe('none')
  })

  it("only CODE's content ever mentions reviewing actual code", () => {
    // Regression guard for the "only tech reviews code" requirement — every
    // non-CODE variant's EASY/HARD checklist labels must be code-free.
    const codeLikePattern = /console\.log|await db\.|function \(|const \w+ = require|=>\s*{/
    for (const variant of ['MARKETING', 'DATA', 'DESIGN', 'BUSINESS'] as const) {
      for (const tier of ['EASY', 'HARD'] as const) {
        const content = getQaContent(variant, tier)
        for (const option of content.checklistOptions) {
          expect(codeLikePattern.test(option.label), `${variant}/${tier}: "${option.label}"`).toBe(false)
        }
      }
    }
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
    const result = combineCrucibleScores(perfectQa, 100, 100, 100, 100, VALID_AI_TOOLS, ALL_MEDIUM)
    expect(result.score).toBe(100)
    expect(result.band).toBe('Blocked it cold')
    expect(result.branch).toBe('PASS')
  })

  it('worst case across all five activities, no bonus, scores 0', () => {
    const worstQa = scoreQaSubmission('CODE', 'MEDIUM', qa({}))
    // rawPoints=5 here (herring-calibrated only) is the true floor for a
    // SHIP verdict — combineCrucibleScores itself still clamps to 0 as a
    // defensive floor, exercised directly by feeding it a synthetic
    // zero-raw-points breakdown.
    const zeroQa = { ...worstQa, rawPoints: 0, defectPoints: 0, verdictPoints: 0, herringPoints: 0 }
    const result = combineCrucibleScores(zeroQa, 0, 0, 0, 0, null, { qa: 'EASY', prompt: 'EASY', dataset: 'EASY' })
    expect(result.score).toBe(0)
    expect(result.band).toBe('The glitch shipped')
    expect(result.branch).toBe('GROWTH')
  })

  it('weights QA 35%, fluency 20%, and prompt/dataset/results 15% each, then adds the flat driver bonus', () => {
    // rawPoints=65 (defect 60 + verdict 0 + herring-calibrated 5) → 65/90 =
    // 72.222...% → *0.35 = 25.2777... ; prompt/dataset/results/fluency all
    // 0*weight=0 → 25.2777... rounds to 25.
    const qaResult = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'SHIP' }))
    const result = combineCrucibleScores(qaResult, 0, 0, 0, 0, null, ALL_MEDIUM)
    expect(result.score).toBe(25)
    expect(result.branch).toBe('GROWTH')
  })

  it('breakdown reports the rounded weighted contribution of each AI-graded activity', () => {
    const qaResult = scoreQaSubmission('CODE', 'MEDIUM', qa({}))
    const result = combineCrucibleScores(qaResult, 83, 67, 50, 90, null, ALL_MEDIUM)
    expect(result.breakdown.promptPoints).toBe(Math.round(83 * 0.15))
    expect(result.breakdown.datasetPoints).toBe(Math.round(67 * 0.15))
    expect(result.breakdown.resultsPoints).toBe(Math.round(50 * 0.15))
    expect(result.breakdown.fluencyPoints).toBe(Math.round(90 * 0.2))
  })

  it('driver bonus requires both a tool AND a non-empty description of how', () => {
    const qaResult = scoreQaSubmission('CODE', 'MEDIUM', qa({}))
    const withEmptyMove = combineCrucibleScores(qaResult, 0, 0, 0, 0, { tools: ['Claude'], bestMove: '' }, ALL_MEDIUM)
    expect(withEmptyMove.breakdown.driverBonusEarned).toBe(false)
    const withNoTools = combineCrucibleScores(qaResult, 0, 0, 0, 0, { tools: [], bestMove: 'traced it' }, ALL_MEDIUM)
    expect(withNoTools.breakdown.driverBonusEarned).toBe(false)
  })

  it('reports the tiers reached verbatim, independent of the numeric score', () => {
    const qaResult = scoreQaSubmission('CODE', 'HARD', qa({ selectedOptionIds: ['qa_hard_idempotency'], verdict: 'BLOCK' }))
    const tiersReached: CrucibleTiersReached = { qa: 'HARD', prompt: 'EASY', dataset: 'MEDIUM' }
    const result = combineCrucibleScores(qaResult, 40, 60, 55, 45, null, tiersReached)
    expect(result.tiersReached).toEqual(tiersReached)
  })

  it('is a pure function — identical inputs always produce an identical result (§11 determinism guarantee)', () => {
    const qaResult = scoreQaSubmission('CODE', 'MEDIUM', qa({ selectedOptionIds: ['code_never_saved'], verdict: 'BLOCK' }))
    const a = combineCrucibleScores(qaResult, 75, 60, 80, 65, VALID_AI_TOOLS, ALL_MEDIUM)
    const b = combineCrucibleScores(qaResult, 75, 60, 80, 65, VALID_AI_TOOLS, ALL_MEDIUM)
    expect(a).toEqual(b)
  })

  it('stamps the current scoring/content version on every result', () => {
    const qaResult = scoreQaSubmission('CODE', 'MEDIUM', qa({}))
    const result = combineCrucibleScores(qaResult, 0, 0, 0, 0, null, ALL_MEDIUM)
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
