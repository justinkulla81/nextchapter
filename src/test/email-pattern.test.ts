import { describe, expect, it } from 'vitest'
import { applyTemplate, learnPatterns, nameParts, templatesFor } from '@/lib/crm/email-pattern'

describe('names', () => {
  it('drops honorifics, credentials, class years and middle initials', () => {
    expect(nameParts("Dr. Jane Q. Roe-Smith, PhD '09")).toEqual({ first: 'jane', last: 'roesmith' })
    expect(nameParts('John S. Prizner III')).toEqual({ first: 'john', last: 'prizner' })
    expect(nameParts('Madonna')).toBeNull()
  })
})

describe('templates', () => {
  it('recognises the common university formats', () => {
    expect(templatesFor('sjohnson', 'Simon Johnson')).toEqual(['flast'])
    expect(templatesFor('john.prizner', 'John S. Prizner III')).toEqual(['first.last'])
    expect(templatesFor('Nhowell1', 'Nyisha Howell')).toEqual(['flast'])
    expect(templatesFor('xyz', 'Simon Johnson')).toEqual([])
  })
})

describe('learning a domain’s format', () => {
  it('takes the format most known addresses share', () => {
    const p = learnPatterns([
      { name: 'Ann Lee', email: 'ann.lee@tulane.edu' },
      { name: 'Bo Diaz', email: 'bo.diaz@tulane.edu' },
      { name: 'Cy Park', email: 'cpark@tulane.edu' },
      { name: 'Simon Johnson', email: 'sjohnson@mit.edu' },
    ])
    expect(p.get('tulane.edu')).toEqual({ template: 'first.last', examples: 3, matching: 2 })
    expect(p.get('mit.edu')).toEqual({ template: 'flast', examples: 1, matching: 1 })
    expect(applyTemplate('flast', 'Paul Freed', 'mit.edu')).toBe('pfreed@mit.edu')
  })
  it('does not trust a split vote or a single first-name-only address', () => {
    const p = learnPatterns([
      { name: 'Ann Lee', email: 'ann.lee@x.edu' },
      { name: 'Bo Diaz', email: 'bdiaz@x.edu' },
      { name: 'Cy Park', email: 'cy@y.edu' },
    ])
    expect(p.has('x.edu')).toBe(false)
    expect(p.has('y.edu')).toBe(false)
  })
})
