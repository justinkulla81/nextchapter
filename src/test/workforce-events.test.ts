import { describe, expect, it } from 'vitest'
import { readLayoffHeadline, readWorkforceEvent, readCollar } from '@/lib/warn/news-headline'
import { layoffTypeLabel } from '@/lib/warn/layoff-alert-rules'

const co = (h: string) => readLayoffHeadline(h)?.company ?? null

describe('workforce events beyond a plain layoff', () => {
  it.each([
    ['BT to make 500 staff redundant', 'BT', 'redundancy'],
    ['Vodafone announces 11,000 redundancies', 'Vodafone', 'redundancy'],
    ['Ford offers voluntary buyouts to 5,000 workers', 'Ford', 'buyout'],
    ['Intel launches voluntary separation program', 'Intel', 'buyout'],
    ['Starbucks to close its Seattle office', 'Starbucks', 'closure'],
    ['Fortis Games shuts down, up to 440 workers affected', 'Fortis Games', 'closure'],
    ['Boeing to relocate headquarters to Arlington', 'Boeing', 'relocation'],
    ['Kroger merger could cut 3,000 jobs', 'Kroger', 'merger'],
    ['Salesforce cuts 4,000 jobs as AI takes over support', 'Salesforce', 'ai_displacement'],
    ['Disney lays off 300 employees', 'Disney', 'layoff'],
  ] as const)('%s', (headline, company, event) => {
    expect(co(headline)).toBe(company)
    expect(readWorkforceEvent(headline)).toBe(event)
  })
  it('still skips headlines that are not a workforce action', () => {
    for (const h of [
      'Apple stock closes higher on Tuesday', 'Apple to Shut Down Its Support Community Forum Next Week', 'I-64 in Chesterfield shut down for hours after power lines fall',
      'Tesla to wind down Cybertruck production as US sales collapse 48%', 'Illicit massage parlor in Edgewood shut down for code violations, police say',
      'Kroger gives go-ahead to shut down all 1,233 stores for 24 hours next month', 'Bills shut down Carson Wentz, Vikings in win', 'Sony is shutting down the PlayStation Plus PC app', 'Dubai Airports CEO Says Biometrics Could Make Passports Redundant Within Five Years',
      'Florida Congressman Invites Tesla to Relocate Headquarters From Texas', 'Jailer 2 Worldwide Closing Box Office Collections: Superstar starrer is a hit',
    ]) expect(co(h), h).toBeNull()
    expect(co('Why moving your office is hard')).toBeNull()
  })
  it('names the event in the entry label, and leaves a plain layoff as it was', () => {
    expect(layoffTypeLabel({ publishers: 2, publisher: 'x', percent: null, event: 'Voluntary buyout' })).toBe('Voluntary buyout · Reported by 2 publishers')
    expect(layoffTypeLabel({ publishers: 2, publisher: 'x', percent: null, event: 'Layoff' })).toBe('Reported by 2 publishers')
  })
  it('reads white-collar, blue-collar or neither from a headline, and neither is common', () => {
    expect(readCollar('Salesforce cuts 4,000 software and support jobs')).toBe('white')
    expect(readCollar('Ferrara Candy to close Chicago plant, 200 jobs')).toBe('blue')
    expect(readCollar('Qantas to cut 850 jobs')).toBe('unknown')
  })
  it('reads the company out of a headline with a sector word or place in front of it, and drops what is not a company', () => {
    expect(co('Insurer FM will move HQ to Providence tower, close Johnston office')).toBe('FM')
    expect(co('Cambridge-based HubSpot announces 660 layoffs amid restructuring')).toBe('HubSpot')
    expect(co('Mobile publisher Fortis Games shuts down, up to 440 workers affected')).toBe('Fortis Games')
    expect(co('BT has cut nearly 12,000 jobs in a year, but why could more redundancies follow?')).toBe('BT')
    for (const h of ['Almost 300 workers cut at plant', 'Staffing to cut nearly 700 Illinois jobs', 'Eiji Aonuma on Nintendo Layoffs: 10,977 Jobs Lost', 'Fierce Biotech Layoff Tracker 2026: Vertex trims 78 employees', 'Largest Australian airline to cut 850 jobs, move work to India', 'Restaurants and bars cut 7,200 jobs in October', 'Staffing co. to cut nearly 700 Illinois jobs']) expect(co(h), h).toBeNull()
  })
})
