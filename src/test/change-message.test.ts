import { describe, expect, it } from 'vitest'
import { changeMessage } from '@/lib/journey/change-message'

describe('what we say after a change', () => {
  it('says what the plan follows and that finished steps stay', () => {
    expect(changeMessage({ journeyChanged: true, stageChanged: true, toJourney: 'PROMOTION', toStage: 'PREPARING', plan: { kept: 4, replaced: 5 } })).toBe(
      'Your plan now follows Going for a promotion. Your 4 finished steps stay, with their points.',
    )
  })
  it('handles one step, none, and no plan this week', () => {
    expect(changeMessage({ journeyChanged: false, stageChanged: true, toJourney: 'LAID_OFF', toStage: 'APPLYING', plan: { kept: 1, replaced: 4 } })).toMatch(/follows Applying\. Your 1 finished step stays/)
    expect(changeMessage({ journeyChanged: true, stageChanged: false, toJourney: 'GROWING', toStage: 'STAYING', plan: { kept: 0, replaced: 4 } })).toMatch(/Everything you have done stays/)
    expect(changeMessage({ journeyChanged: true, stageChanged: false, toJourney: 'GROWING', toStage: 'STAYING', plan: null })).toMatch(/Everything you have done stays/)
  })
  it('says nothing when nothing changed', () => {
    expect(changeMessage({ journeyChanged: false, stageChanged: false, toJourney: null, toStage: null, plan: null })).toBeNull()
  })
})
