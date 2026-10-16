import { describe, expect, it } from 'vitest'
import { DIMENSIONS, cleanCultureFit, cultureContext, culturePlanItems, culturePromptLine, cultureSummary, interviewQuestions, offerChecks, parseCultureFit } from '@/lib/culture/culture-fit'

const very = cleanCultureFit({ importance: 'VERY', answers: { pace: 'STEADY', collaboration: 'INDEPENDENT', hours: 'PREDICTABLE_HOURS', growth: null }, mustHave: 'No weekend work', dealBreaker: 'Constant reorgs' })!
const somewhat = cleanCultureFit({ importance: 'SOMEWHAT', answers: { management: 'AUTONOMOUS' } })!
const not = cleanCultureFit({ importance: 'NOT_IMPORTANT', answers: { pace: 'FAST' }, mustHave: 'x' })!

describe('culture and working environment', () => {
  it('asks only whether it matters first: six short questions, two options each', () => {
    expect(DIMENSIONS).toHaveLength(6)
    for (const d of DIMENSIONS) expect(d.options).toHaveLength(2)
  })
  it('if it is not important, nothing else is kept and nothing is added anywhere', () => {
    expect(not).toEqual({ importance: 'NOT_IMPORTANT', answers: {}, mustHave: null, dealBreaker: null })
    expect(interviewQuestions(not)).toEqual([])
    expect(offerChecks(not)).toEqual([])
    expect(culturePlanItems(not, 'INTERVIEWING')).toEqual([])
    expect(culturePromptLine(not)).toBeNull()
    expect(cultureContext({ importance: 'NOT_IMPORTANT' })).toBe('')
    expect(cultureContext(null)).toBe('')
  })
  it('rejects unknown importance and drops answers that are not real options', () => {
    expect(cleanCultureFit({ importance: 'ALOT', answers: {} })).toBeNull()
    expect(cleanCultureFit({ importance: 'VERY', answers: { pace: 'WARP' } })!.answers).toEqual({})
    expect(parseCultureFit('nonsense')).toBeNull()
  })
  it('turns what matters into interview questions, including their own words', () => {
    const qs = interviewQuestions(very)
    expect(qs).toHaveLength(5) // three dimensions + must have + deal breaker
    expect(qs.join(' ')).toMatch(/uninterrupted time/)
    expect(qs.join(' ')).toMatch(/No weekend work/)
    expect(qs.join(' ')).toMatch(/Constant reorgs/)
    expect(interviewQuestions(somewhat)).toHaveLength(1)
  })
  it('adds offer checks only when it matters a lot', () => {
    expect(offerChecks(very).join(' ')).toMatch(/Your deal breaker/)
    expect(offerChecks(somewhat)).toEqual([])
  })
  it('puts steps in the plan by stage: a conversation early, questions when interviewing, a check at the offer', () => {
    expect(culturePlanItems(very, 'PREPARING')[0].actionType).toBe('OUTREACH_CALL')
    expect(culturePlanItems(very, 'INTERVIEWING')[0].text).toMatch(/steady and well planned/)
    expect(culturePlanItems(very, 'OFFER')[0].text).toMatch(/Check the offer/)
    expect(culturePlanItems(somewhat, 'PREPARING')).toEqual([])
    expect(culturePlanItems(somewhat, 'INTERVIEWING')).toHaveLength(1)
    expect(culturePlanItems(very, 'LANDED')).toEqual([])
  })
  it('gives the report, fit check and coach one line of context, only when it matters', () => {
    expect(culturePromptLine(very)).toMatch(/very important/)
    expect(culturePromptLine(very)).toMatch(/Deal breaker: Constant reorgs/)
    expect(cultureContext(very)).toMatch(/^\nCulture and working environment:/)
    expect(cultureSummary(very)).toEqual(['steady and well planned', 'independent, with focus time', 'predictable hours, firm boundaries'])
  })
})
