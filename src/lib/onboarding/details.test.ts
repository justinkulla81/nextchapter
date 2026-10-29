import { describe, expect, it } from 'vitest'
import { adminCandidateLabel, checkDetails, needsContactDetails, normalizeLinkedInUrl } from './details'

describe('needsContactDetails', () => {
  it('needs the step until a name and an email are all there', () => {
    expect(needsContactDetails({ firstName: null, lastName: null, email: null })).toBe(true)
    expect(needsContactDetails({ firstName: 'Ana', lastName: null, email: 'a@b.co' })).toBe(true)
    expect(needsContactDetails({ firstName: 'Ana', lastName: 'Lee', email: '  ' })).toBe(true)
    expect(needsContactDetails({ firstName: 'Ana', lastName: 'Lee', email: 'a@b.co' })).toBe(false)
  })
})

describe('checkDetails', () => {
  const ok = { firstName: ' Ana ', lastName: 'Lee', email: ' ana@example.com ', linkedInUrl: '' }
  it('trims, and treats LinkedIn as optional', () => {
    expect(checkDetails(ok)).toEqual({ ok: true, value: { firstName: 'Ana', lastName: 'Lee', email: 'ana@example.com', linkedInUrl: null } })
  })
  it('asks for each missing piece', () => {
    expect(checkDetails({ ...ok, firstName: ' ' })).toMatchObject({ ok: false })
    expect(checkDetails({ ...ok, lastName: '' })).toMatchObject({ ok: false })
    expect(checkDetails({ ...ok, email: 'nope' })).toMatchObject({ ok: false })
  })
  it('rejects a non-LinkedIn address but accepts a bare one', () => {
    expect(checkDetails({ ...ok, linkedInUrl: 'https://example.com/in/ana' })).toMatchObject({ ok: false })
    expect(checkDetails({ ...ok, linkedInUrl: 'linkedin.com/in/ana' })).toMatchObject({ ok: true, value: { linkedInUrl: 'https://linkedin.com/in/ana' } })
  })
})

describe('normalizeLinkedInUrl', () => {
  it('handles blank, www and lookalike hosts', () => {
    expect(normalizeLinkedInUrl('')).toBeNull()
    expect(normalizeLinkedInUrl('www.linkedin.com/in/ana')).toBe('https://www.linkedin.com/in/ana')
    expect(normalizeLinkedInUrl('https://notlinkedin.com/in/ana')).toBeUndefined()
    expect(normalizeLinkedInUrl('https://linkedin.com.evil.io/in/ana')).toBeUndefined()
  })
})

describe('adminCandidateLabel', () => {
  it('prefers the name, then the email, then says nothing is known', () => {
    expect(adminCandidateLabel({ firstName: 'Ana', lastName: 'Lee', email: 'a@b.co' })).toBe('Ana Lee')
    expect(adminCandidateLabel({ firstName: null, lastName: null, email: 'a@b.co' })).toBe('a@b.co')
    expect(adminCandidateLabel({ firstName: null, lastName: null, email: null })).toBe('Candidate (no details yet)')
  })
})
