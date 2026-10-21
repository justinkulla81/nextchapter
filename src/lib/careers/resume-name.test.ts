import { describe, expect, it } from 'vitest'
import { guessNameFromResumeText } from '@/lib/careers/resume-name'

describe('guessNameFromResumeText', () => {
  it('reads a name on the first line', () => {
    expect(guessNameFromResumeText('Ada Lovelace\nNew York, NY\nada@example.org')).toBe('Ada Lovelace')
  })

  it('reads an ALL CAPS name and a name followed by contact details', () => {
    expect(guessNameFromResumeText('ADA LOVELACE\nProduct leader')).toBe('Ada Lovelace')
    expect(guessNameFromResumeText('Ada Lovelace | New York, NY | ada@example.org')).toBe('Ada Lovelace')
  })

  it('keeps middle initials, hyphens and apostrophes', () => {
    expect(guessNameFromResumeText('Anne-Marie J. O’Neil\nVP of Sales')).toBe('Anne-Marie J. O’Neil')
  })

  it('skips a heading above the name', () => {
    expect(guessNameFromResumeText('RESUME\n\nAda Lovelace\nada@example.org')).toBe('Ada Lovelace')
    expect(guessNameFromResumeText('Curriculum Vitae\nAda Lovelace')).toBe('Ada Lovelace')
  })

  it('does not take contact lines, phone numbers or one-word lines for a name', () => {
    expect(guessNameFromResumeText('ada@example.org\n(212) 555-0100\nSummary')).toBeNull()
    expect(guessNameFromResumeText('Experience\nSkills')).toBeNull()
  })

  it('does not take a sentence for a name', () => {
    expect(guessNameFromResumeText('Seasoned product leader with a record of shipping')).toBeNull()
  })

  it('returns null for empty text', () => {
    expect(guessNameFromResumeText('')).toBeNull()
    expect(guessNameFromResumeText(null)).toBeNull()
  })
})
