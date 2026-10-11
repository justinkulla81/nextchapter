import { describe, expect, it } from 'vitest'
import { cleanAccentColor, cleanImageUrl, cleanSlug, readBranding } from '@/lib/institution/branding'

describe('institution branding', () => {
  it('accepts only six-digit hex colours', () => {
    expect(cleanAccentColor('#a3182b')).toBe('#A3182B')
    expect(cleanAccentColor('red')).toBeNull()
    expect(cleanAccentColor('#fff')).toBeNull()
    expect(cleanAccentColor('#a3182b; background:url(x)')).toBeNull()
  })
  it('accepts only https images', () => {
    expect(cleanImageUrl('https://cdn.example.edu/logo.png')).toBe('https://cdn.example.edu/logo.png')
    expect(cleanImageUrl('javascript:alert(1)')).toBeNull()
    expect(cleanImageUrl('http://insecure.example/logo.png')).toBeNull()
  })
  it('normalises and validates slugs', () => {
    expect(cleanSlug('Washington Jefferson')).toBe('washington-jefferson')
    expect(cleanSlug('a')).toBeNull()
    expect(cleanSlug('../etc')).toBeNull()
  })
  it('reads hero and tagline from the profile JSON', () => {
    const b = readBranding({
      accentColor: '#112233',
      logoUrl: null,
      profile: { heroImageUrl: 'https://x.example/h.jpg', tagline: ' Presidents  ' },
    })
    expect(b).toMatchObject({ accentColor: '#112233', heroImageUrl: 'https://x.example/h.jpg', tagline: 'Presidents' })
  })
})
