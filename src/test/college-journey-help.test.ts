import { describe, expect, it } from 'vitest'
import { JOURNEYS } from '@/lib/journey/journey'
import { stageHelp } from '@/lib/higher-ed/lifecycle'

const opts = { hasPrograms: true, hasOfficeHours: true, hasEvents: true, hasJobs: true }

describe('a college shows something for every journey', () => {
  it('every journey gets a card of its own, and never more than four', () => {
    for (const j of JOURNEYS) {
      const items = stageHelp(j.defaultStage, 'demo', { ...opts, journey: j.key })
      expect(items.length, j.key).toBeGreaterThan(0)
      expect(items.length, j.key).toBeLessThanOrEqual(4)
      expect(new Set(items.map((i) => i.key)).size).toBe(items.length)
    }
  })
  it('Managing my career is no longer three generic cards', () => {
    const keys = stageHelp('STAYING', 'demo', { ...opts, journey: 'GROWING' }).map((i) => i.key)
    expect(keys).toEqual(expect.arrayContaining(['growthPrograms', 'sponsor']))
  })
  it('programs are left out when the college has none', () => {
    const keys = stageHelp('STAYING', 'demo', { ...opts, hasPrograms: false, journey: 'GROWING' }).map((i) => i.key)
    expect(keys).not.toContain('growthPrograms')
    expect(keys).not.toContain('programs')
  })
})
