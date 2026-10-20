import { describe, expect, it } from 'vitest'
import { HOW_I_PERFORM_ITEMS } from '@/lib/constants/how-i-perform-items'
import { FLOWS } from '@/lib/redesign/flows'
import { PERFORMANCE_FLOW, PERFORMANCE_ROUNDS, answersFromScores, performanceComplete, performanceResponses, scoresFromAnswers } from '@/lib/redesign/performance-rounds'
import {
  MAX_QUESTIONS_PER_ROUND,
  chunkEvenly,
  evenChunkSizes,
  firstOpenRound,
  mergeAnswers,
  sanitizeAllAnswers,
  sanitizeRoundAnswers,
  totalAnswered,
  validateFlow,
  type RoundAnswers,
} from '@/lib/redesign/rounds'
import { TRACK_RECORD_FIELD_IDS, TRACK_RECORD_FLOW, answersFromTrackRecord, trackRecordUpdate } from '@/lib/redesign/track-record-rounds'

// The fields TrackRecordForm.tsx / updateTrackRecord save today. If the long form gains or loses one, this list must too.
const LEGACY_TRACK_RECORD_FIELDS = [
  'largestTeamManaged', 'largestOrgIndirect', 'budgetOwned', 'approvalAuthority', 'situationRanking', 'mandateClarity',
  'functionsOwnedOutsideCore', 'droveOutcomesThroughOthers', 'peopleHiredDirectly', 'ledThroughRestructuring', 'sectorHistory',
  'stageHistory', 'boardExposure', 'largestInitiativeScope', 'longestTenure', 'isPeopleManager', 'pnlAccountability',
  'geographicScope', 'reportedToLevel', 'accomplishmentToConfirm',
]

describe('splitting into rounds', () => {
  it('never makes a round bigger than three, and uses the fewest rounds', () => {
    for (let n = 1; n <= 60; n++) {
      const sizes = evenChunkSizes(n)
      expect(sizes.reduce((a, b) => a + b, 0)).toBe(n)
      expect(Math.max(...sizes)).toBeLessThanOrEqual(MAX_QUESTIONS_PER_ROUND)
      expect(sizes.length).toBe(Math.ceil(n / MAX_QUESTIONS_PER_ROUND))
    }
    expect(evenChunkSizes(8)).toEqual([3, 3, 2])
    expect(evenChunkSizes(0)).toEqual([])
  })

  it('keeps order and loses nothing', () => {
    const items = Array.from({ length: 8 }, (_, i) => i)
    expect(chunkEvenly(items).flat()).toEqual(items)
  })
})

describe.each(Object.values(FLOWS))('$id flow', (flow) => {
  it('is safe to ship: rounds of three at most, every question in exactly one round, sensible kinds', () => {
    expect(validateFlow(flow)).toEqual([])
    for (const r of flow.rounds) expect(r.questionIds.length).toBeLessThanOrEqual(MAX_QUESTIONS_PER_ROUND)
  })

  it('starts at the first round when nothing is answered and says why before asking', () => {
    expect(firstOpenRound(flow, {})).toBe(0)
    for (const r of flow.rounds) expect(r.why.length).toBeGreaterThan(20)
  })
})

describe('track record rounds', () => {
  it('asks exactly the questions the long form asks, once each', () => {
    expect([...TRACK_RECORD_FIELD_IDS].sort()).toEqual([...LEGACY_TRACK_RECORD_FIELDS].sort())
    expect(TRACK_RECORD_FLOW.rounds.flatMap((r) => r.questionIds).sort()).toEqual([...LEGACY_TRACK_RECORD_FIELDS].sort())
  })

  it('puts functions owned outside the core in the breadth round with the payoff naming them', () => {
    const round = TRACK_RECORD_FLOW.rounds.find((r) => r.questionIds.includes('functionsOwnedOutsideCore'))!
    const empty = TRACK_RECORD_FLOW.payoff({}, round)
    expect(empty.headline).toMatch(/Answer to add/)
    const answered = TRACK_RECORD_FLOW.payoff({ functionsOwnedOutsideCore: ['MARKETING', 'SALES'] }, round)
    expect(answered.headline).toBe('1 of 20 facts are in your dossier.')
    expect(answered.lines.join(' ')).toContain('Marketing and Sales')
  })

  it('converts answers to the columns the long form saves, only for what was answered', () => {
    const { row, isPeopleManager } = trackRecordUpdate({
      isPeopleManager: ['yes'],
      largestTeamManaged: ['SIX_TO_TWENTY'],
      ledThroughRestructuring: ['no'],
      mandateClarity: ['3'],
      situationRanking: ['FIX_WHAT_S_BROKEN', 'BUILD_FROM_ZERO'],
      accomplishmentToConfirm: ['Cut onboarding time in half'],
      notAField: ['x'],
    })
    expect(isPeopleManager).toBe(true)
    expect(row).toEqual({
      largestTeamManaged: 'SIX_TO_TWENTY',
      ledThroughRestructuring: false,
      mandateClarity: 3,
      situationRanking: ['FIX_WHAT_S_BROKEN', 'BUILD_FROM_ZERO'],
      accomplishmentToConfirm: 'Cut onboarding time in half',
    })
    expect(trackRecordUpdate({})).toEqual({ row: {}, isPeopleManager: null })
  })

  it('reads a saved row back as answers, leaving nulls open', () => {
    const a = answersFromTrackRecord(
      { largestTeamManaged: 'ONE_TO_FIVE', budgetOwned: null, approvalAuthority: ['HIRING'], sectorHistory: [], mandateClarity: 4, ledThroughRestructuring: true, accomplishmentToConfirm: null },
      false,
    )
    expect(a).toEqual({ isPeopleManager: ['no'], largestTeamManaged: ['ONE_TO_FIVE'], approvalAuthority: ['HIRING'], mandateClarity: ['4'], ledThroughRestructuring: ['yes'] })
    expect(answersFromTrackRecord(null, null)).toEqual({})
  })

  it('finishes with facts that rest on real answers', () => {
    const none = TRACK_RECORD_FLOW.finish({})
    expect(none.open).toBe(20)
    expect(none.gains.map((g) => g.place)).toEqual(['Dossier'])
    const some = TRACK_RECORD_FLOW.finish({ largestTeamManaged: ['NONE'], functionsOwnedOutsideCore: ['HR'], accomplishmentToConfirm: ['Shipped it'] })
    expect(some.gains.map((g) => g.place)).toEqual(['Dossier', 'Strengths', 'Learn', 'Network'])
    expect(some.open).toBe(17)
  })
})

describe('performance rounds', () => {
  it('asks every one of the forty statements exactly once, in rounds of three at most', () => {
    const ids = PERFORMANCE_ROUNDS.flatMap((r) => r.questionIds)
    expect(ids).toHaveLength(HOW_I_PERFORM_ITEMS.length)
    expect(new Set(ids).size).toBe(HOW_I_PERFORM_ITEMS.length)
    expect(ids.sort()).toEqual(HOW_I_PERFORM_ITEMS.map((i) => `item-${i.id}`).sort())
    expect(PERFORMANCE_ROUNDS).toHaveLength(15)
    expect(Math.max(...PERFORMANCE_ROUNDS.map((r) => r.questionIds.length))).toBe(3)
  })

  it('keeps the four-point scale as adjacent buttons and the same 1 to 4 scores', () => {
    for (const q of PERFORMANCE_FLOW.questions) {
      expect(q.kind).toBe('buttons')
      expect(q.options?.map((o) => o.value)).toEqual(['1', '2', '3', '4'])
    }
  })

  it('round-trips scores and only completes with all forty', () => {
    const all: Record<string, number> = Object.fromEntries(HOW_I_PERFORM_ITEMS.map((i) => [String(i.id), (i.id % 4) + 1]))
    const answers = answersFromScores(all)
    expect(scoresFromAnswers(answers)).toEqual(all)
    expect(performanceComplete(answers)).toBe(true)
    expect(performanceResponses(answers)).toHaveLength(40)
    const { 40: _dropped, ...thirtyNine } = all
    void _dropped
    expect(performanceComplete(answersFromScores(thirtyNine))).toBe(false)
  })

  it('ignores scores that are not whole numbers from 1 to 4 or not real items', () => {
    expect(answersFromScores({ '1': 5, '2': 0, '3': 2.5, '999': 3, '4': 4 })).toEqual({ 'item-4': ['4'] })
  })

  it('reports progress in the payoff and an honest finish', () => {
    const round = PERFORMANCE_ROUNDS[0]
    expect(PERFORMANCE_FLOW.payoff({}, round).headline).toMatch(/Answer to move/)
    const p = PERFORMANCE_FLOW.payoff({ 'item-1': ['3'], 'item-2': ['2'] }, round)
    expect(p.headline).toBe('2 of 40 statements answered.')
    expect(p.lines[0]).toBe('Execution: 2 of 8 answered.')
    const partial = PERFORMANCE_FLOW.finish({ 'item-1': ['3'] })
    expect(partial.open).toBe(39)
    expect(partial.gains).toEqual([])
    const full = PERFORMANCE_FLOW.finish(answersFromScores(Object.fromEntries(HOW_I_PERFORM_ITEMS.map((i) => [String(i.id), 3]))))
    expect(full.open).toBe(0)
    expect(full.gains.length).toBeGreaterThan(0)
  })
})

describe('saving a round is non-destructive', () => {
  const saved: RoundAnswers = { largestTeamManaged: ['SIX_TO_TWENTY'], budgetOwned: ['ONE_M_TO_10M'], sectorHistory: ['TECH', 'RETAIL'] }

  it('adds this round and leaves every other answer as it was', () => {
    const merged = mergeAnswers(saved, { peopleHiredDirectly: ['ONE_TO_FIVE'] })
    expect(merged).toEqual({ ...saved, peopleHiredDirectly: ['ONE_TO_FIVE'] })
    expect(saved).toEqual({ largestTeamManaged: ['SIX_TO_TWENTY'], budgetOwned: ['ONE_M_TO_10M'], sectorHistory: ['TECH', 'RETAIL'] })
  })

  it('changes an answer only when a new one is given, and never erases on a blank', () => {
    const merged = mergeAnswers(saved, { largestTeamManaged: ['TWENTY_ONE_TO_FIFTY'], budgetOwned: [], sectorHistory: ['  '] })
    expect(merged.largestTeamManaged).toEqual(['TWENTY_ONE_TO_FIFTY'])
    expect(merged.budgetOwned).toEqual(['ONE_M_TO_10M'])
    expect(merged.sectorHistory).toEqual(['TECH', 'RETAIL'])
  })

  it('ignores questions outside the round it is allowed to touch', () => {
    expect(mergeAnswers(saved, { budgetOwned: ['NONE'] }, ['largestTeamManaged'])).toEqual(saved)
  })

  it('counts progress from what is saved, so a returning member resumes at the first open round', () => {
    expect(totalAnswered(TRACK_RECORD_FLOW, saved)).toBe(3)
    const firstRound = TRACK_RECORD_FLOW.rounds[0]
    const done = Object.fromEntries(firstRound.questionIds.map((id) => [id, ['yes']]))
    expect(firstOpenRound(TRACK_RECORD_FLOW, done)).toBe(1)
  })
})

describe('what a server action trusts from the browser', () => {
  const round = TRACK_RECORD_FLOW.rounds[0]
  it('keeps only this round’s questions and listed option values', () => {
    const clean = sanitizeRoundAnswers(TRACK_RECORD_FLOW, round, {
      isPeopleManager: ['yes'],
      largestTeamManaged: ['NOT_A_BAND'],
      peopleHiredDirectly: ['ONE_TO_FIVE', 'SIX_TO_TWENTY'],
      budgetOwned: ['NONE'],
      toString: ['x'],
    })
    expect(clean).toEqual({ isPeopleManager: ['yes'], peopleHiredDirectly: ['ONE_TO_FIVE'] })
  })

  it('caps text, dedupes picks and drops junk', () => {
    const proof = TRACK_RECORD_FLOW.rounds.find((r) => r.id === 'proof')!
    const text = sanitizeRoundAnswers(TRACK_RECORD_FLOW, proof, { accomplishmentToConfirm: ['x'.repeat(900)], longestTenure: [3, null] })
    expect(text.accomplishmentToConfirm![0]).toHaveLength(500)
    expect(text.longestTenure).toBeUndefined()
    const breadth = TRACK_RECORD_FLOW.rounds.find((r) => r.id === 'breadth')!
    expect(sanitizeRoundAnswers(TRACK_RECORD_FLOW, breadth, { sectorHistory: ['TECH', 'TECH', 'NOPE'] }).sectorHistory).toEqual(['TECH'])
    expect(sanitizeRoundAnswers(TRACK_RECORD_FLOW, breadth, 'nonsense')).toEqual({})
    expect(sanitizeAllAnswers(TRACK_RECORD_FLOW, { sectorHistory: ['TECH'], isPeopleManager: ['no'] })).toEqual({ sectorHistory: ['TECH'], isPeopleManager: ['no'] })
  })
})
