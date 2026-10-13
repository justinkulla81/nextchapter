import { describe, expect, it } from 'vitest'
import { MAX_ASK, cleanConversation, conversationPlanItem, type ConversationInput } from '@/lib/review-prep/conversation'
import { engagementPlanItems, type EngagementSignals } from '@/lib/journey/engagement'

const ok: ConversationInput = { kind: 'RAISE', scheduledFor: '2026-11-04', askAmount: '$145,000', askLevel: '', reasons: ['Cut onboarding from 14 days to 6', '', ''], walkAway: 'Start a quiet search' }

describe('saving your ask', () => {
  it('cleans a good ask: dollars and commas allowed, blanks dropped', () => {
    const r = cleanConversation(ok)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.askAmount).toBe(145000)
      expect(r.value.reasons).toEqual(['Cut onboarding from 14 days to 6'])
      expect(r.value.scheduledFor?.toISOString().slice(0, 10)).toBe('2026-11-04')
    }
  })
  it('says what is wrong and what to do, for each way it can fail', () => {
    const cases: [Partial<ConversationInput>, RegExp][] = [
      [{ kind: '' }, /kind of conversation/],
      [{ askAmount: 'a lot' }, /whole number of dollars/],
      [{ askAmount: String(MAX_ASK + 1) }, /does not look right/],
      [{ askAmount: '', askLevel: '' }, /Add your ask/],
      [{ reasons: ['', '', ''] }, /at least one reason/],
      [{ reasons: ['a', 'b', 'c', 'd'] }, /three strongest/],
      [{ reasons: ['x'.repeat(301), '', ''] }, /under 300/],
      [{ scheduledFor: '11/04/2026' }, /year-month-day/],
      [{ scheduledFor: '2026-13-45' }, /does not exist/],
    ]
    for (const [over, msg] of cases) {
      const r = cleanConversation({ ...ok, ...over })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error).toMatch(msg)
    }
  })
  it('a level alone is a valid ask', () => {
    expect(cleanConversation({ ...ok, askAmount: '', askLevel: 'Senior director' }).ok).toBe(true)
  })
})

describe('an upcoming conversation reaches the plan', () => {
  const now = new Date('2026-10-30T00:00:00Z')
  it('says what to do and when', () => {
    expect(conversationPlanItem([{ kind: 'RAISE', scheduledFor: new Date('2026-11-04T12:00:00Z'), outcome: 'PENDING' }], now)!.text).toMatch(/raise conversation is in 6 days/)
    expect(conversationPlanItem([{ kind: 'REVIEW', scheduledFor: new Date('2026-10-31T00:00:00Z'), outcome: 'PENDING' }], now)!.text).toMatch(/is tomorrow/)
  })
  it('ignores past, far-off and finished conversations', () => {
    expect(conversationPlanItem([{ kind: 'RAISE', scheduledFor: new Date('2026-10-01T00:00:00Z'), outcome: 'PENDING' }], now)).toBeNull()
    expect(conversationPlanItem([{ kind: 'RAISE', scheduledFor: new Date('2026-12-30T00:00:00Z'), outcome: 'PENDING' }], now)).toBeNull()
    expect(conversationPlanItem([{ kind: 'RAISE', scheduledFor: new Date('2026-11-02T00:00:00Z'), outcome: 'GOT_IT' }], now)).toBeNull()
  })
  it('goes first in the weekly plan', () => {
    const s: EngagementSignals = {
      journey: 'GROWING', stage: 'STAYING', tone: null, casual: false, workingNow: false,
      redFlags: { restrictiveCovenant: false, firedForCause: false, noDrugTest: false, noBackgroundCheck: false },
      conversations: [{ kind: 'RAISE', scheduledFor: new Date(Date.now() + 3 * 86_400_000), outcome: 'PENDING' }],
      weeksInStage: 2, gmail: false, calendar: false, linkedin: true, completedReferences: 3, requestedReferences: 3, referencesTarget: 3,
      openResumeIssues: 0, hasPersonalityProfile: true, skillsAssessmentDone: true, dossierUnlocked: true, outreach: 0, applications: 0, interviews: 0, offers: 0,
    }
    expect(engagementPlanItems(s)[0].text).toMatch(/raise conversation/)
  })
})
