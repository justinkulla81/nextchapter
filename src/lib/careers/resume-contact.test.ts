import { describe, expect, it } from 'vitest'
import { findEmailInResumeText, missingContactMessage } from '@/lib/careers/resume-contact'

describe('findEmailInResumeText', () => {
  it('finds the first email address and lower-cases it', () => {
    expect(findEmailInResumeText('Ada Lovelace\nAda.Lovelace@Example.org | (212) 555-0100')).toBe('ada.lovelace@example.org')
    expect(findEmailInResumeText('ada@example.org\nReferences: bob@example.com')).toBe('ada@example.org')
  })

  it('handles plus tags, hyphens and subdomains', () => {
    expect(findEmailInResumeText('ada+jobs@mail.my-site.co.uk')).toBe('ada+jobs@mail.my-site.co.uk')
  })

  it('returns null when there is none', () => {
    expect(findEmailInResumeText('Ada Lovelace\nNew York')).toBeNull()
    expect(findEmailInResumeText('')).toBeNull()
    expect(findEmailInResumeText(null)).toBeNull()
  })
})

describe('missingContactMessage', () => {
  it('is null when both are found', () => {
    expect(missingContactMessage({ name: 'Ada Lovelace', email: 'ada@example.org' })).toBeNull()
  })

  it('names what is missing', () => {
    expect(missingContactMessage({ name: null, email: null })).toContain('name and email address')
    expect(missingContactMessage({ name: 'Ada', email: null })).toContain('email address')
    expect(missingContactMessage({ name: 'Ada', email: null })).not.toContain('name')
    expect(missingContactMessage({ name: null, email: 'ada@example.org' })).toContain('your name')
  })

  it('says what to do next', () => {
    expect(missingContactMessage({ name: null, email: null })).toMatch(/Upload a version/)
  })
})
