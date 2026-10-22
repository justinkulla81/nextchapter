import { describe, expect, it } from 'vitest'
import { exposureEventProps } from '@/lib/skills/ai-at-work-shared'

describe('ai_exposure_shown properties', () => {
  it('carries soc6, band and whether a split is shown', () => {
    expect(exposureEventProps({ soc6: '11-1021', band: 'some' }, { measured: 10 })).toEqual({ soc6: '11-1021', band: 'some', hasSplit: true })
  })
  it('is null-safe when the occupation is not measured or there is no split', () => {
    expect(exposureEventProps(null, null)).toEqual({ soc6: null, band: null, hasSplit: false })
    expect(exposureEventProps(null, { measured: 0 })).toEqual({ soc6: null, band: null, hasSplit: false })
  })
})
