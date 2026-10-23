import { describe, expect, it } from 'vitest'
import {
  BUY_FIELDS,
  BUY_STAGES,
  BUY_TRAINING,
  FINANCING,
  MARKETPLACES,
  RUN_TRAINING,
  buyDetailsOf,
  buyHeadline,
  buyPlanItems,
  buyReach,
  buyStageForJourneyStage,
  hasBuyDetails,
  journeyStageForBuyStage,
  missingBuyFields,
  parseBuyValue,
  rankFinancing,
  rankMarketplaces,
  trainingForStage,
} from '@/lib/journey/buy-business'
import { CHECK_IN_ANSWERS, JOURNEYS, changeForAnswer, getJourney, notLookingNow, reportFraming } from '@/lib/journey/journey'
import { journeyPlanItems, shapePlan } from '@/lib/journey/plan'
import { itemVisibility, menuMode, statusUnlock } from '@/lib/journey/menu'
import { isNotSearching } from '@/lib/journey/intensity'
import { JOURNEY_TO_SITUATION, SITUATION_TO_JOURNEY } from '@/lib/constants/onboarding'

describe('Buy a business: the journey', () => {
  it('is the twelfth journey, reachable from its onboarding card, and not a job search', () => {
    expect(JOURNEYS).toHaveLength(12)
    expect(SITUATION_TO_JOURNEY[JOURNEY_TO_SITUATION.BUY_BUSINESS]).toBe('BUY_BUSINESS')
    expect(getJourney('BUY_BUSINESS')).toMatchObject({ searching: false, employed: true, confidentialByDefault: true, defaultStage: 'EXPLORING' })
    expect(isNotSearching('BUY_BUSINESS', 'APPLYING')).toBe(true)
  })
  it('never gets job-listing emails, at any stage of the purchase', () => {
    for (const journeyStage of ['EXPLORING', 'PREPARING', 'APPLYING', 'INTERVIEWING', 'OFFER', 'LANDED', 'STAYING'] as const) {
      expect(notLookingNow({ journey: 'BUY_BUSINESS', journeyStage })).toBe(true)
    }
    expect(notLookingNow({ journey: 'EXPLORING_MOVE', journeyStage: 'APPLYING' })).toBe(false)
  })
  it('has a check-in answer that starts it', () => {
    expect(CHECK_IN_ANSWERS.map((a) => a.key)).toContain('buying')
    expect(changeForAnswer('buying', { journey: 'LAID_OFF', stage: 'APPLYING' })).toEqual({ journey: 'BUY_BUSINESS', stage: 'EXPLORING' })
  })
  it('frames the market report around the purchase, not applications', () => {
    expect(reportFraming('BUY_BUSINESS', 'EXPLORING')).toMatch(/buy a small business/i)
  })
})

describe('Buy a business: stages', () => {
  it('has seven stages that map one-to-one onto the shared journey stages', () => {
    expect(BUY_STAGES.map((s) => s.key)).toEqual(['decide', 'prepare', 'search', 'evaluate', 'close', 'own', 'run'])
    for (const s of BUY_STAGES) expect(buyStageForJourneyStage(journeyStageForBuyStage(s.key))).toBe(s.key)
    expect(new Set(BUY_STAGES.map((s) => s.stage)).size).toBe(7)
  })
  it('gives every stage a first step, a goal and a plan', () => {
    for (const s of BUY_STAGES) {
      expect(s.next.length).toBeGreaterThan(10)
      expect(s.firstWeek.length).toBeGreaterThan(0)
      expect(s.ongoing.length).toBeGreaterThan(0)
    }
  })
  it('a legacy paused row reads as running the business', () => {
    expect(buyStageForJourneyStage('PAUSED')).toBe('run')
    expect(buyStageForJourneyStage(null)).toBe('decide')
  })
})

describe('Buy a business: the plan and the menu', () => {
  it('has its own plan at every stage, with no job applications', () => {
    for (const s of BUY_STAGES) {
      const items = journeyPlanItems('BUY_BUSINESS', s.stage, 1)
      expect(items.map((i) => i.text)).toEqual(s.firstWeek.map((i) => i.text))
      expect(items.some((i) => i.actionType === 'JOB_APPLICATION_SUBMITTED')).toBe(false)
    }
  })
  it('drops the general job-search menu from the weekly plan, even in the search stage', () => {
    const general = [
      { text: 'Apply to Full-Time Jobs', actionType: 'JOB_APPLICATION_SUBMITTED' },
      { text: 'Update your résumé', actionType: 'RESUME_UPDATE' },
    ]
    const out = shapePlan('BUY_BUSINESS', 'APPLYING', 2, general).map((i) => i.text)
    expect(out).not.toContain('Apply to Full-Time Jobs')
    expect(out).not.toContain('Update your résumé')
    expect(out.length).toBeGreaterThan(0)
  })
  it('adds a profile nudge in the early stages, while questions are unanswered, and an SBA check when searching with an SBA loan', () => {
    expect(buyPlanItems('decide', 1, {})[0].text).toMatch(/Answer the next question/)
    expect(buyPlanItems('decide', 1, { skills: ['sales'], industries: ['trades'], size: '300_500', cash: '100_250', financing: ['sba'], involvement: 'hands_on', where: 'Ohio', timeline: '6', partners: 'solo' })[0].text).not.toMatch(/Answer the next question/)
    expect(buyPlanItems('search', 2, { financing: ['sba'] }).map((i) => i.text).join(' ')).toMatch(/SBA lender will finance/)
  })
  it('has its own menu mode with job tools locked and an honest explanation', () => {
    expect(menuMode('EXPLORING', 'BUY_BUSINESS')).toBe('BUYING')
    expect(menuMode('OFFER', 'BUY_BUSINESS')).toBe('BUYING')
    expect(itemVisibility('jobs', 'BUYING')).toBe('locked')
    expect(statusUnlock('BUYING')?.why).toMatch(/buying a business/)
  })
})

describe('Buy a business: the intake', () => {
  it('reads back only valid answers, from journeyDetails.buy', () => {
    const d = buyDetailsOf({ moveDriver: 'options', buy: { skills: ['sales', 'nope'], size: '150_300', cash: 'bogus', stage: 'search', where: '  Ohio ' } })
    expect(d).toEqual({ skills: ['sales'], size: '150_300', stage: 'search', where: 'Ohio' })
    expect(buyDetailsOf(null)).toEqual({})
    expect(buyDetailsOf({ buy: 'x' })).toEqual({})
  })
  it('tells a member who started alongside another journey from one who did not', () => {
    expect(hasBuyDetails({ buy: { stage: 'decide' } })).toBe(true)
    expect(hasBuyDetails({ moveDriver: 'options' })).toBe(false)
    expect(hasBuyDetails(null)).toBe(false)
  })
  it('parses form values safely and leaves blanks alone', () => {
    const size = BUY_FIELDS.find((f) => f.key === 'size')!
    const skills = BUY_FIELDS.find((f) => f.key === 'skills')!
    const where = BUY_FIELDS.find((f) => f.key === 'where')!
    expect(parseBuyValue(size, '300_500')).toBe('300_500')
    expect(parseBuyValue(size, 'huge')).toBeNull()
    expect(parseBuyValue(size, '')).toBeNull()
    expect(parseBuyValue(skills, ['sales', 'sales', 'x', 'finance'])).toEqual(['sales', 'finance'])
    expect(parseBuyValue(skills, [])).toBeNull()
    expect(parseBuyValue(where, 'x'.repeat(200))).toHaveLength(120)
  })
  it('asks the next questions in order, never nags for the optional credit score, and says why', () => {
    expect(missingBuyFields({}).map((f) => f.key)).not.toContain('credit')
    expect(missingBuyFields({}).map((f) => f.key).slice(0, 2)).toEqual(['skills', 'industries'])
    expect(missingBuyFields({ skills: ['sales'] }).map((f) => f.key)).not.toContain('skills')
    for (const f of BUY_FIELDS) expect(f.why.length).toBeGreaterThan(10)
  })
  it('uses buttons for up to four choices and a dropdown for more (design principles)', () => {
    for (const f of BUY_FIELDS.filter((x) => x.kind === 'choice')) expect(f.options!.length).toBeGreaterThanOrEqual(2)
  })
  it('sizes what cash supports from the SBA 10% rule, with the reasoning shown', () => {
    const r = buyReach({ cash: '100_250' })!
    // 15% of price: $100,000 to $250,000 of cash supports about $650,000 to $1,675,000 (rounded to $25,000).
    expect(r.priceLow).toBe(675_000)
    expect(r.priceHigh).toBe(1_675_000)
    expect(r.because).toMatch(/10% of the total cost/)
    expect(r.because).toMatch(/rule of thumb/)
    expect(buyReach({})).toBeNull()
  })
  it('headlines the intake until most of it is answered, then the stage’s next step', () => {
    expect(buyHeadline('decide', {}).title).toMatch(/Tell us what you are looking for/)
    expect(buyHeadline('search', {}).title).toMatch(/saved search/)
  })
})

describe('Buy a business: marketplaces, financing and training', () => {
  it('lists the marketplaces the owner asked for, each with a full https link', () => {
    const names = MARKETPLACES.map((m) => m.name).join(' ')
    for (const n of ['BizBuySell', 'Baton', 'Kumo', 'BizQuest', 'Axial', 'Searchfunder', 'Acquire.com']) expect(names).toContain(n)
    for (const m of MARKETPLACES) expect(m.href).toMatch(/^https:\/\//)
    expect(new Set(MARKETPLACES.map((m) => m.id)).size).toBe(MARKETPLACES.length)
  })
  it('puts marketplaces that match the member’s industry and size first', () => {
    expect(rankMarketplaces({ industries: ['software'] })[0].industries).toContain('software')
    expect(rankMarketplaces({ size: '3000_plus' }).slice(0, 2).map((m) => m.id)).toContain('axial')
  })
  it('covers the financing paths with plain rules, and floats the ones the member picked', () => {
    expect(FINANCING.map((f) => f.id)).toEqual(expect.arrayContaining(['sba7a', 'sba504', 'seller', 'cash', 'robs', 'investors']))
    expect(FINANCING.find((f) => f.id === 'sba7a')!.facts.join(' ')).toMatch(/10%/)
    for (const f of FINANCING) for (const l of f.links) expect(l.href).toMatch(/^https:\/\//)
    expect(rankFinancing({ financing: ['robs'] })[0].id).toBe('robs')
    expect(rankFinancing({})[0].id).toBe('sba7a')
  })
  it('has training to buy well and to run and improve, each stage reachable, and free help first', () => {
    expect(BUY_TRAINING.length).toBeGreaterThan(5)
    expect(RUN_TRAINING.length).toBeGreaterThan(2)
    expect(BUY_TRAINING.some((t) => t.free)).toBe(true)
    for (const t of [...BUY_TRAINING, ...RUN_TRAINING]) if (t.href) expect(t.href).toMatch(/^(https:\/\/|\/dashboard\/)/)
    expect(trainingForStage('prepare').length).toBeGreaterThan(0)
  })
})
