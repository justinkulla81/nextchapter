import { describe, expect, it } from 'vitest'
import { functionLabelForTitle, isCorporateDevelopmentTitle } from '@/lib/jobs/job-functions'
import { buildTitleIndex, CORP_DEV_SOC, matchTitle } from '@/lib/careers/title-match'
import parity from './fixtures/corp-dev-parity.json'

// Corporate development / M&A titles are Strategy, never "Fundraising & development"
// (2026-10-20). The rule is the crawler's (ncrawl/taxonomy.corp_dev_title); the fixture is its
// verdict on every corp-dev / M&A / fundraising-phrase title the crawler has stored.
describe('corporate development titles', () => {
  it('matches ncrawl (Python) on every parity title', () => {
    const mismatches = (parity as [string, boolean][])
      .filter(([title, want]) => isCorporateDevelopmentTitle(title) !== want)
      .map(([title, want]) => ({ title, want }))
    expect(mismatches).toEqual([])
  })

  it('files corp dev / M&A titles under Strategy', () => {
    for (const title of [
      'Corporate Development',
      'Director, Corporate Development',
      'Corp Dev Manager',
      'M&A Director',
      'Business Development – Corporate Development',
      'Strategic Partnerships & Corporate Development',
      'Chief Corporate Development Officer',
    ]) {
      expect(functionLabelForTitle('development', title), title).toBe('Strategy')
    }
  })

  it('keeps real fundraising titles in Fundraising & development', () => {
    for (const title of [
      'Director of Development',
      'Development Officer',
      'Major Gifts Officer',
      'Director of Advancement',
      'Annual Fund Manager',
      'Donor Relations Manager',
      'Grants Manager',
      'Corporate Development Officer',
    ]) {
      expect(isCorporateDevelopmentTitle(title), title).toBe(false)
      expect(functionLabelForTitle('development', title), title).toBe('Fundraising & development')
    }
  })

  it("leaves another function's deal-team titles to that function", () => {
    for (const title of ['M&A Counsel', 'HR M&A Director', 'IT Program Director - M&A', 'M&A Tax Manager', 'Executive Assistant II, Corporate Development']) {
      expect(isCorporateDevelopmentTitle(title), title).toBe(false)
    }
    expect(functionLabelForTitle('legal', 'M&A Counsel')).toBe('Legal')
  })

  it('places corp dev titles in O*NET Financial and Investment Analysts, not Fundraising Managers', () => {
    const index = buildTitleIndex(
      [
        { socCode: '11-2033.00', title: 'Fundraising Managers' },
        { socCode: CORP_DEV_SOC, title: 'Financial and Investment Analysts' },
      ],
      [{ socCode: '11-2033.00', title: 'Development Director' }]
    )
    const corp = matchTitle(index, 'Director, Corporate Development')
    expect(corp.kind === 'EXACT' && corp.socCode).toBe(CORP_DEV_SOC)
    const fund = matchTitle(index, 'Development Director')
    expect(fund.kind === 'EXACT' && fund.socCode).toBe('11-2033.00')
  })
})
