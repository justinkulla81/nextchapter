import { describe, it, expect } from 'vitest'
import { alertBody, alertSubject, layoffTypeLabel, shouldAlert, sizeLabel, type AlertInput } from '@/lib/warn/layoff-alert-rules'
import { readPercent } from '@/lib/warn/news-headline'

const base: AlertInput = {
  employer: 'Acme', employees: 300, percent: null, kind: 'news', confirmed: true,
  inCrm: false, people: 0, warm: 0, contactsFound: 0,
}

describe('shouldAlert', () => {
  it('alerts on 250 or more jobs', () => {
    expect(shouldAlert({ employees: 250, inCrm: false })).toBe(true)
    expect(shouldAlert({ employees: 249, inCrm: false })).toBe(false)
  })
  it('alerts on any layoff at an employer already in the CRM', () => {
    expect(shouldAlert({ employees: null, inCrm: true })).toBe(true)
    expect(shouldAlert({ employees: 12, inCrm: true })).toBe(true)
  })
  it('does not alert on an unknown size at an unknown company', () => {
    expect(shouldAlert({ employees: null, inCrm: false })).toBe(false)
  })
})

describe('the email', () => {
  it('names the company, size and CRM state in the subject', () => {
    expect(alertSubject(base)).toBe('Layoff alert: Acme (300 jobs)')
    expect(alertSubject({ ...base, inCrm: true, confirmed: false })).toBe('Layoff alert: Acme (300 jobs) — in your CRM — unconfirmed')
    expect(alertSubject({ ...base, employees: null, percent: 30 })).toContain('30% of staff')
    expect(sizeLabel(null, null)).toBe('size unknown')
  })

  it('says how warm the relationship is, and escapes the company name', () => {
    const html = alertBody({ ...base, employer: 'A<b>&Co', inCrm: true, people: 3, warm: 1 }, { source: 'https://x.test/a', org: 'https://x.test/o', notices: 'https://x.test/n' })
    expect(html).toContain('3 people, 1 warm')
    expect(html).toContain('A&lt;b&gt;&amp;Co')
    expect(html).not.toContain('<b>&Co')
  })
})

describe('layoffTypeLabel and readPercent', () => {
  it('labels the outlet count and adds the share of staff', () => {
    expect(layoffTypeLabel({ publishers: 2, publisher: null, percent: null })).toBe('Reported by 2 publishers')
    expect(layoffTypeLabel({ publishers: 1, publisher: 'Reuters', percent: 30 })).toBe('Reported by 1 publisher (Reuters) — unconfirmed · 30% of staff')
  })

  it('reads a share of staff but not a stock move or a rate', () => {
    expect(readPercent('Bumble to cut 30% of workforce')).toBe(30)
    expect(readPercent('Salesforce reduces headcount by 4%')).toBe(4)
    expect(readPercent('Stock falls 5% after layoffs announced')).toBeNull()
    expect(readPercent('Fed cuts rates by 0.25%')).toBeNull()
  })
})
