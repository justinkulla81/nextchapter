import { describe, it, expect } from 'vitest'
import { parseYearsRequired, formatYearsRequirement } from '@/lib/jobs/years-required'

const p = (s: string) => parseYearsRequired(s)

describe('parseYearsRequired — plain phrasing', () => {
  it.each([
    ['5+ years of experience in product management', 5, null],
    ['7+ yrs of relevant experience', 7, null],
    ['Minimum of 7 years of progressive finance experience', 7, null],
    ['minimum 10 years experience', 10, null],
    ['At least eight years of experience leading teams', 8, null],
    ['10-15 years of experience', 10, 15],
    ['10 – 15 years experience in marketing', 10, 15],
    ['10 to 15 years of leadership experience', 10, 15],
    ['Between 8 and 12 years of experience', 8, 12],
    ['Five (5) years of experience managing budgets', 5, null],
    ['ten (10) or more years of experience', 10, null],
    ['12 or more years of experience in operations', 12, null],
    ['15 years or more of progressive HR leadership', 15, null],
    ['A decade of experience in enterprise sales', 10, null],
    ['Two decades of experience in banking', 20, null],
    ['Requires 3 years working in a regulated environment', 3, null],
    ['You have 6 years in a customer-facing role', 6, null],
    ['8 years managing P&L', 8, null],
    ['Bachelor’s degree and 4 years’ experience', 4, null],
    ['20+ years of executive leadership', 20, null],
  ])('%s', (text, min, max) => {
    const r = p(text)
    expect(r?.min).toBe(min)
    expect(r?.max).toBe(max)
    expect(r?.strength).toBe('required')
  })
})

describe('parseYearsRequired — not an experience requirement', () => {
  it.each([
    'Founded 25 years ago, we are a leader in logistics.',
    'This is a 2-year contract position.',
    'Applicants must be 18 years of age or older.',
    'Over the past 10 years we have grown to 5,000 employees.',
    'We have been in business for 40 years.',
    'Benefits vest over 4 years.',
    'Reports to the CEO. Competitive salary.',
    '',
  ])('%s', (text) => {
    expect(p(text)).toBeNull()
  })
  it('null/undefined', () => {
    expect(parseYearsRequired(null)).toBeNull()
    expect(parseYearsRequired(undefined)).toBeNull()
  })
})

describe('parseYearsRequired — preferred vs required', () => {
  it('preferred in the sentence', () => {
    const r = p('7+ years of experience preferred.')
    expect(r).toMatchObject({ min: 7, strength: 'preferred' })
  })
  it('ideally', () => {
    expect(p('Ideally 5 years of experience in SaaS')?.strength).toBe('preferred')
  })
  it('a plus', () => {
    expect(p('10 years of healthcare experience is a plus')?.strength).toBe('preferred')
  })
  it('preferred qualifications heading', () => {
    const text = 'Required qualifications:\n- Bachelor’s degree\nPreferred qualifications:\n- 8+ years of experience in fintech'
    expect(p(text)).toMatchObject({ min: 8, strength: 'preferred' })
  })
  it('required beats preferred even when the preferred number is larger', () => {
    const text = 'Requirements:\n- 5+ years of experience in sales\nNice to have:\n- 10+ years of experience in enterprise sales'
    expect(p(text)).toMatchObject({ min: 5, strength: 'required' })
  })
  it('or equivalent is flagged', () => {
    const r = p('5+ years of relevant experience or equivalent combination of education and experience')
    expect(r).toMatchObject({ min: 5, orEquivalent: true, strength: 'required' })
  })
})

describe('parseYearsRequired — several numbers', () => {
  it('largest required minimum wins', () => {
    expect(p('10+ years of experience, including 5 years in a leadership role')?.min).toBe(10)
  })
  it('sub-requirement listed first', () => {
    expect(p('3+ years of experience with Python. 8+ years of software engineering experience.')?.min).toBe(8)
  })
  it('ignores founding history alongside a real requirement', () => {
    expect(p('For over 30 years we have served clients. You bring 12+ years of experience in audit.')?.min).toBe(12)
  })
  it('phrase is kept for display', () => {
    expect(p('10-15 years of experience')?.phrase).toBe('10-15 years')
  })
})

describe('formatYearsRequirement', () => {
  it('formats', () => {
    expect(formatYearsRequirement(null)).toBe('Not stated')
    expect(formatYearsRequirement(p('10-15 years of experience'))).toBe('10–15 yrs')
    expect(formatYearsRequirement(p('7+ years of experience preferred'))).toBe('7+ yrs (preferred)')
  })
})
