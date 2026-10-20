import { describe, it, expect } from 'vitest'
import { alertBody, alertSubject, groupSummary, layoffTypeLabel, shouldAlert, sizeLabel, type AlertInput } from '@/lib/warn/layoff-alert-rules'
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

describe('the people tied to the layoff', () => {
  const groups = [
    {
      key: 'head_hr', label: 'Head of HR', why: 'Signs off on severance.', emptyHint: 'Run the HR finder.',
      cards: [{ name: 'Pat <Lee>', title: 'Chief People Officer', org: 'Acme', email: 'pat@acme.test', phone: '555-0100', strength: 'warm' as const, href: 'https://x.test/p/1' }],
    },
    { key: 'rapid_response', label: 'State Rapid Response (TX)', why: 'Meets the employer.', emptyHint: 'Add the state coordinator.', cards: [] },
    {
      key: 'job_centers', label: 'American Job Centers nearby', why: 'Walk-in centers.', emptyHint: 'None.',
      cards: [{ name: 'Austin Center', title: 'Comprehensive center', org: '1 Main St', email: null, phone: null, strength: null, href: null }],
      more: 3, moreHref: 'https://x.test/o',
    },
  ]

  it('summarizes the groups', () => {
    expect(groupSummary(groups)).toEqual({ people: 2, withEmail: 1, strong: 1, covered: 2, total: 3 })
  })

  it('renders each group with its people, an empty group with a hint, and escapes names', () => {
    const html = alertBody({ ...base, place: 'Travis County, TX', groups }, { source: null, org: null, notices: 'https://x.test/n' })
    expect(html).toContain('Who to contact')
    expect(html).toContain('2 people across 2 of 3 groups')
    expect(html).toContain('Travis County, TX')
    expect(html).toContain('mailto:pat@acme.test')
    expect(html).toContain('Pat &lt;Lee&gt;')
    expect(html).not.toContain('Pat <Lee>')
    expect(html).toContain('None on file. Add the state coordinator.')
    expect(html).toContain('and 3 more')
    expect(html).toContain('No email yet')
  })

  it('marks a guessed address and leaves the section out when there are no groups', () => {
    const g = [{ ...groups[0], cards: [{ ...groups[0].cards[0], guessed: true }] }]
    expect(alertBody({ ...base, groups: g }, { source: null, org: null, notices: 'n' })).toContain('(guessed)')
    expect(groupSummary(g).withEmail).toBe(0)
    expect(alertBody(base, { source: null, org: null, notices: 'n' })).not.toContain('Who to contact')
  })
})

describe('orderGroups', () => {
  const card = (email: string | null, guessed = false) => ({ email, guessed })
  it('puts groups with an email first and empty groups last, keeping order within each', async () => {
    const { orderGroups } = await import('@/lib/warn/layoff-alert-rules')
    const groups = [
      { key: 'a', cards: [] },
      { key: 'b', cards: [card(null)] },
      { key: 'c', cards: [card('x@y.com')] },
      { key: 'd', cards: [card('g@y.com', true)] },
      { key: 'e', cards: [card('z@y.com')] },
    ]
    expect(orderGroups(groups).map((g) => g.key)).toEqual(['c', 'e', 'b', 'd', 'a'])
  })
})
