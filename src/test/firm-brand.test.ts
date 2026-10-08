import { describe, it, expect } from 'vitest'
import { firmTheme, isHexColor, normalizeWebsite, readableOn, websiteButtonHtml } from '@/lib/recruiter/brand'

describe('firm brand', () => {
  it('falls back to safe defaults', () => {
    const t = firmTheme({ accentColor: 'red', brandFont: 'comic', brandTone: null })
    expect(t.accent).toBe('#1d4e89')
    expect(t.font).toBe('editorial')
    expect(t.tone).toBe('cream')
  })
  it('uses the firm choices when valid', () => {
    const t = firmTheme({ accentColor: '#2b3b3b', brandFont: 'modern', brandTone: 'white' })
    expect(t.accent).toBe('#2b3b3b')
    expect(t.bg).toBe('#ffffff')
    expect(t.fontStack).toContain('system-ui')
  })
  it('picks readable text on light and dark accents', () => {
    expect(readableOn('#ffffff')).toBe('#14233b')
    expect(readableOn('#1d4e89')).toBe('#ffffff')
    expect(isHexColor('#1D4E89')).toBe(true)
    expect(isHexColor('1d4e89')).toBe(false)
  })
  it('normalises websites', () => {
    expect(normalizeWebsite('example.com')).toEqual({ ok: true, url: 'https://example.com' })
    expect(normalizeWebsite('http://www.example.com/')).toEqual({ ok: true, url: 'http://www.example.com' })
    expect(normalizeWebsite('')).toEqual({ ok: true, url: null })
    expect(normalizeWebsite('nodots').ok).toBe(false)
  })
  it('builds a website button with readable text', () => {
    const html = websiteButtonHtml('https://x.test/in/acme', '#ffffff')
    expect(html).toContain('background:#ffffff')
    expect(html).toContain('color:#14233b')
  })
})
