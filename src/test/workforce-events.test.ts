import { describe, expect, it } from 'vitest'
import { readLayoffHeadline, readWorkforceEvent } from '@/lib/warn/news-headline'
import { layoffTypeLabel } from '@/lib/warn/layoff-alert-rules'

const co = (h: string) => readLayoffHeadline(h)?.company ?? null

describe('workforce events beyond a plain layoff', () => {
  it.each([
    ['BT to make 500 staff redundant', 'BT', 'redundancy'],
    ['Vodafone announces 11,000 redundancies', 'Vodafone', 'redundancy'],
    ['Ford offers voluntary buyouts to 5,000 workers', 'Ford', 'buyout'],
    ['Intel launches voluntary separation program', 'Intel', 'buyout'],
    ['Starbucks to close its Seattle office', 'Starbucks', 'closure'],
    ['Acme Corp to shut down', 'Acme Corp', 'closure'],
    ['Boeing to relocate headquarters to Arlington', 'Boeing', 'relocation'],
    ['Kroger merger could cut 3,000 jobs', 'Kroger', 'merger'],
    ['Salesforce cuts 4,000 jobs as AI takes over support', 'Salesforce', 'ai_displacement'],
    ['Disney lays off 300 employees', 'Disney', 'layoff'],
  ] as const)('%s', (headline, company, event) => {
    expect(co(headline)).toBe(company)
    expect(readWorkforceEvent(headline)).toBe(event)
  })
  it('still skips headlines that are not a workforce action', () => {
    expect(co('Apple stock closes higher on Tuesday')).toBeNull()
    expect(co('Why moving your office is hard')).toBeNull()
  })
  it('names the event in the entry label, and leaves a plain layoff as it was', () => {
    expect(layoffTypeLabel({ publishers: 2, publisher: 'x', percent: null, event: 'Voluntary buyout' })).toBe('Voluntary buyout · Reported by 2 publishers')
    expect(layoffTypeLabel({ publishers: 2, publisher: 'x', percent: null, event: 'Layoff' })).toBe('Reported by 2 publishers')
  })
})
