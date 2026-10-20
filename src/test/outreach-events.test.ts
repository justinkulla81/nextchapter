import { describe, expect, it } from 'vitest'
import { isOutreachEvent, isPermanentBounce } from '@/lib/outreach/event-rules'

const ev = (extra: object, bounce?: object) => ({ type: 'email.bounced', data: { email_id: 'e1', to: ['a@b.com'], bounce, ...extra } })

describe('outreach events', () => {
  it('recognises the outreach tag as an object or a list', () => {
    expect(isOutreachEvent(ev({ tags: { outreach: 'cold' } }))).toBe(true)
    expect(isOutreachEvent(ev({ tags: [{ name: 'outreach', value: 'cold' }] }))).toBe(true)
  })
  it('ignores email without the tag', () => {
    expect(isOutreachEvent(ev({}))).toBe(false)
    expect(isOutreachEvent(ev({ tags: { campaign: 'x' } }))).toBe(false)
  })
  it('treats only a permanent bounce as final', () => {
    expect(isPermanentBounce(ev({}, { type: 'Permanent' }))).toBe(true)
    expect(isPermanentBounce(ev({}, { type: 'Transient' }))).toBe(false)
  })
})
