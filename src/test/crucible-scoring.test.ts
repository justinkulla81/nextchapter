// Crucible build spec §9 acceptance criteria — "scoring matches §4 exactly
// against a test matrix (defect+block / defect+ship / herring-block /
// no-flags each produce specified scores)." Also enforces §11's guarantee
// that the same submission always produces the same score.
import { describe, it, expect } from 'vitest'
import { scoreCrucibleSubmission, SCORING_VERSION, CONTENT_VERSION } from '@/lib/crucible/scoring'
import type { CrucibleFlag, CrucibleSubmission } from '@/lib/crucible/scoring-types'

function submission(overrides: Partial<CrucibleSubmission>): CrucibleSubmission {
  return { flags: [], verdict: 'SHIP', worstThing: '', aiTools: null, ...overrides }
}

const defectFlagExact: CrucibleFlag = {
  line: 25,
  severity: 'minor',
  mechanism: 'DATA_LOST_WRONG_NEVER_SAVED',
  note: 'promo.uses is never saved back to the database',
}
const defectFlagNearMiss: CrucibleFlag = {
  line: 25,
  severity: 'minor',
  mechanism: 'LOGIC_EDGE_CASE_ERROR',
  note: 'this code never actually persists the change so it can be reused unlimited times',
}
const defectFlagWrongEverything: CrucibleFlag = {
  line: 25,
  severity: 'minor',
  mechanism: 'LOGIC_EDGE_CASE_ERROR',
  note: 'seems fine to me',
}
const herringCalibrated: CrucibleFlag = { line: 8, severity: 'cosmetic', mechanism: 'STYLE_CLUTTER', note: 'stray console.log' }
const herringOverblocked: CrucibleFlag = { line: 8, severity: 'critical', mechanism: 'STYLE_CLUTTER', note: 'logs everything' }

describe('scoreCrucibleSubmission — CODE variant', () => {
  it('defect (exact mechanism) + BLOCK + calibrated herring + driver bonus = 100', () => {
    const result = scoreCrucibleSubmission(
      'CODE',
      submission({
        flags: [defectFlagExact, herringCalibrated],
        verdict: 'BLOCK',
        worstThing: 'The promo usage count is never saved',
        aiTools: { tools: ['ChatGPT'], bestMove: 'Asked it to trace every db write in the diff' },
      })
    )
    expect(result.score).toBe(100)
    expect(result.branch).toBe('PASS')
    expect(result.band).toBe('Blocked it cold')
    expect(result.breakdown.defectDetection).toBe('exact')
  })

  it('defect+block (no herring flag, no bonus) scores 85 — "Caught it"', () => {
    const result = scoreCrucibleSubmission('CODE', submission({ flags: [defectFlagExact], verdict: 'BLOCK' }))
    expect(result.score).toBe(85)
    expect(result.branch).toBe('PASS')
    expect(result.band).toBe('Caught it')
  })

  it('defect found but SHIPPED anyway earns detection credit, not verdict credit', () => {
    const result = scoreCrucibleSubmission('CODE', submission({ flags: [defectFlagExact], verdict: 'SHIP' }))
    expect(result.score).toBe(60)
    expect(result.breakdown.verdictPoints).toBe(0)
    expect(result.branch).toBe('GROWTH')
  })

  it('near-miss mechanism with matching keyword note earns 45, not 60', () => {
    const result = scoreCrucibleSubmission('CODE', submission({ flags: [defectFlagNearMiss], verdict: 'BLOCK' }))
    expect(result.breakdown.defectDetection).toBe('near_miss')
    expect(result.score).toBe(45 + 25)
  })

  it('right zone, wrong mechanism, note with no real understanding earns zero defect credit', () => {
    const result = scoreCrucibleSubmission('CODE', submission({ flags: [defectFlagWrongEverything], verdict: 'BLOCK' }))
    expect(result.breakdown.defectDetection).toBe('none')
    expect(result.score).toBe(25) // verdict alone — BLOCK without naming the defect still isn't credited as "correct" per spec (SHIP_WITH_CONDITIONS requires naming it; plain BLOCK is unconditional)
  })

  it('herring flagged critical (over-blocking) costs points even with the real defect caught', () => {
    const result = scoreCrucibleSubmission('CODE', submission({ flags: [defectFlagExact, herringOverblocked], verdict: 'BLOCK' }))
    expect(result.breakdown.herringOutcome).toBe('overblocked')
    expect(result.score).toBe(60 + 25 - 10)
  })

  it('citing the herring as the block reason in worst-thing text also overblocks, even with no flag', () => {
    const result = scoreCrucibleSubmission(
      'CODE',
      submission({ flags: [defectFlagExact], verdict: 'BLOCK', worstThing: 'The console.log statement is the worst thing here' })
    )
    expect(result.breakdown.herringOutcome).toBe('overblocked')
    expect(result.score).toBe(60 + 25 - 10)
  })

  it('no flags at all, SHIP verdict — the glitch shipped, score 0', () => {
    const result = scoreCrucibleSubmission('CODE', submission({}))
    expect(result.score).toBe(0)
    expect(result.band).toBe('The glitch shipped')
    expect(result.branch).toBe('GROWTH')
  })

  it('driver bonus requires both a tool AND a non-empty description of how', () => {
    const withEmptyMove = scoreCrucibleSubmission('CODE', submission({ aiTools: { tools: ['Claude'], bestMove: '' } }))
    expect(withEmptyMove.breakdown.driverBonusEarned).toBe(false)
    const withNoTools = scoreCrucibleSubmission('CODE', submission({ aiTools: { tools: [], bestMove: 'traced it' } }))
    expect(withNoTools.breakdown.driverBonusEarned).toBe(false)
  })

  it('score never goes negative even with maximum penalties', () => {
    const result = scoreCrucibleSubmission('CODE', submission({ flags: [herringOverblocked], verdict: 'SHIP' }))
    expect(result.score).toBe(0)
  })

  it('is a pure function — identical submission always produces an identical score (§11 determinism guarantee)', () => {
    const input = submission({ flags: [defectFlagExact, herringCalibrated], verdict: 'BLOCK' })
    const a = scoreCrucibleSubmission('CODE', input)
    const b = scoreCrucibleSubmission('CODE', input)
    expect(a).toEqual(b)
  })

  it('stamps the current scoring/content version on every result', () => {
    const result = scoreCrucibleSubmission('CODE', submission({}))
    expect(result.scoringVersion).toBe(SCORING_VERSION)
    expect(result.contentVersion).toBe(CONTENT_VERSION)
  })
})

describe('scoreCrucibleSubmission — MARKETING and DATA variants use the same shape', () => {
  it('MARKETING: flagging the fabricated TechCrunch line + BLOCK scores 85', () => {
    const result = scoreCrucibleSubmission(
      'MARKETING',
      submission({
        flags: [{ line: 11, severity: 'critical', mechanism: 'CLAIM_FALSE_UNVERIFIABLE', note: 'DoorList was never reviewed by TechCrunch, this is fabricated' }],
        verdict: 'BLOCK',
      })
    )
    expect(result.score).toBe(85)
    expect(result.branch).toBe('PASS')
  })

  it('DATA: flagging the headline-vs-table contradiction + BLOCK scores 85', () => {
    const result = scoreCrucibleSubmission(
      'DATA',
      submission({
        flags: [{ line: 7, severity: 'critical', mechanism: 'CLAIM_FALSE_UNVERIFIABLE', note: 'the table shows 10.5% growth, not 40% — the math doesn\'t match' }],
        verdict: 'BLOCK',
      })
    )
    expect(result.score).toBe(85)
    expect(result.branch).toBe('PASS')
  })

  it('DATA: flagging the confound line (18-19) instead of the headline still counts as the same defect zone', () => {
    const result = scoreCrucibleSubmission(
      'DATA',
      submission({
        flags: [{ line: 18, severity: 'minor', mechanism: 'CLAIM_FALSE_UNVERIFIABLE', note: 'Solstice is a seasonal confound never controlled for' }],
        verdict: 'SHIP_WITH_CONDITIONS',
      })
    )
    expect(result.breakdown.defectDetection).toBe('exact')
    expect(result.score).toBe(85)
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
