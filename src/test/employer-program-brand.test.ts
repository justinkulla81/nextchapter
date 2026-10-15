import { describe, expect, it } from 'vitest'
import { cleanBrandColor, readProgramSettings } from '@/lib/employer/program-settings'

describe('employer program brand', () => {
  it('reads a stored logo and color', () => {
    const s = readProgramSettings({ brand: { logoUrl: 'https://cdn.example.com/logo.png', accentColor: '#a93439' } })
    expect(s.brand).toEqual({ logoUrl: 'https://cdn.example.com/logo.png', accentColor: '#A93439' })
  })

  it('defaults to no brand for settings saved before this existed', () => {
    expect(readProgramSettings({}).brand).toEqual({ logoUrl: null, accentColor: null })
    expect(readProgramSettings(null).brand).toEqual({ logoUrl: null, accentColor: null })
  })

  it('drops a logo that is not an https link and a color that is not six hex digits', () => {
    expect(readProgramSettings({ brand: { logoUrl: 'javascript:alert(1)', accentColor: 'red' } }).brand).toEqual({ logoUrl: null, accentColor: null })
    expect(readProgramSettings({ brand: { logoUrl: 'http://insecure.example.com/x.png' } }).brand.logoUrl).toBeNull()
  })

  it('validates colors strictly', () => {
    expect(cleanBrandColor('#2e7d5b')).toBe('#2E7D5B')
    expect(cleanBrandColor('#2e7d5')).toBeNull()
    expect(cleanBrandColor('2e7d5b')).toBeNull()
    expect(cleanBrandColor(5)).toBeNull()
  })

  it('keeps the brand when other program settings are saved with the spread pattern the actions use', () => {
    const s = readProgramSettings({ brand: { accentColor: '#112233' }, welcome: 'Hi' })
    const saved = { ...s, welcome: 'Updated' }
    expect(readProgramSettings(saved).brand.accentColor).toBe('#112233')
  })
})
