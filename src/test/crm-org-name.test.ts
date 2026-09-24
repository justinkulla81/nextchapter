// What the capture extension may send as a "company" that must never become
// a CrmOrganization: LinkedIn card text scraped from the wrong section, and
// job-seeking statuses typed into the company field.
import { describe, it, expect } from 'vitest'
import { isRealOrgName, placeholderOrgKindFor } from '@/lib/crm/normalize'

describe('isRealOrgName', () => {
  it('rejects LinkedIn company-card text', () => {
    expect(isRealOrgName('United NationsInternational Affairs6,888,866 followers')).toBe(false)
    expect(isRealOrgName('L CattertonInvestment Management97,485 followers')).toBe(false)
  })
  it('rejects job-seeking statuses and maps them to the unemployed placeholder', () => {
    for (const s of ['looking for new opportunity', 'Seeking my next role', 'Open to work', 'In transition', 'seeking opportunities']) {
      expect(isRealOrgName(s)).toBe(false)
      expect(placeholderOrgKindFor(s)).toBe('unemployed')
    }
  })
  it('keeps real organizations', () => {
    for (const s of ['Oracle', 'United Nations', 'Harvard University', 'NextChapter', 'Next Chapter Partners', 'Seeking Alpha', 'Looking Glass Labs']) {
      expect(isRealOrgName(s)).toBe(true)
    }
  })
})
