import { describe, expect, it } from 'vitest'
import { DOSSIER_EFFORT_MINUTES_TARGET, effortTargetFor } from './dossier-targets'

describe('effortTargetFor', () => {
  it('uses the default when there is no override', () => {
    expect(effortTargetFor(null)).toBe(DOSSIER_EFFORT_MINUTES_TARGET)
    expect(effortTargetFor(undefined)).toBe(DOSSIER_EFFORT_MINUTES_TARGET)
  })
  it('uses a sane override', () => {
    expect(effortTargetFor(120)).toBe(120)
  })
  it('ignores nonsense', () => {
    for (const bad of [0, -5, 1.5, 1_000_000, Number.NaN]) expect(effortTargetFor(bad)).toBe(DOSSIER_EFFORT_MINUTES_TARGET)
  })
})
