import { describe, expect, it } from 'vitest'
import { absoluteWebUrl } from '@/lib/http/external-url'

describe('absoluteWebUrl', () => {
  it('adds https to a scheme-less address', () => {
    expect(absoluteWebUrl('garfield.utah.gov/departments/planningeconomic-development')).toBe('https://garfield.utah.gov/departments/planningeconomic-development')
    expect(absoluteWebUrl('www.indypartnership.com')).toBe('https://www.indypartnership.com')
    expect(absoluteWebUrl('//example.org/x')).toBe('https://example.org/x')
  })
  it('keeps full web addresses', () => {
    expect(absoluteWebUrl('http://example.org/a')).toBe('http://example.org/a')
    expect(absoluteWebUrl(' https://example.org ')).toBe('https://example.org')
  })
  it('returns null for paths, special links and junk', () => {
    for (const v of ['/jobs', '#top', 'mailto:a@b.org', 'tel:+15551234', 'ftp://x.org', 'not a url', 'localhost', '', null, undefined]) expect(absoluteWebUrl(v as string)).toBeNull()
  })
})
