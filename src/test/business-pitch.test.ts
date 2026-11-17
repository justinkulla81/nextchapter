import { describe, expect, it } from 'vitest'
import { pitchSettingsFromForm, readPitchSettings } from '@/lib/workforce/business-pitch'

const form = (o: Record<string, string>) => {
  const fd = new FormData()
  for (const [k, v] of Object.entries(o)) fd.set(k, v)
  return fd
}

describe('business pitch settings', () => {
  it('reads nothing as empty, never invents', () => {
    expect(readPitchSettings(null)).toEqual({ incentives: [], officeCost: null, pitchLine: null })
  })
  it('keeps filled incentive rows with their sources and skips empty ones', () => {
    const s = pitchSettingsFromForm(form({ incentiveName0: 'Jobs tax credit', incentiveDetail0: 'Up to 5% of payroll', incentiveSource0: 'State economic development office', incentiveName2: '', officePerSqFt: '24.5', officeSource: 'Broker report Q3' }))
    expect(s.incentives).toEqual([{ name: 'Jobs tax credit', detail: 'Up to 5% of payroll', source: 'State economic development office' }])
    expect(s.officeCost).toEqual({ perSqFtYear: 24.5, note: '', source: 'Broker report Q3' })
  })
  it('rejects silly office costs', () => {
    expect(pitchSettingsFromForm(form({ officePerSqFt: '-3' })).officeCost).toBeNull()
    expect(pitchSettingsFromForm(form({ officePerSqFt: '9999' })).officeCost).toBeNull()
  })
  it('round-trips what was saved', () => {
    const s = pitchSettingsFromForm(form({ incentiveName0: 'Training grant', incentiveSource0: 'Workforce board', pitchLine: 'Big-city talent, small-city costs.' }))
    expect(readPitchSettings({ businessPitch: s })).toEqual(s)
  })
})
