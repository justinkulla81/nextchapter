import { describe, it, expect } from 'vitest'
import { costLines, formatUsd, readFilingCosts, readLayoffCost, readOutplacement } from '@/lib/warn/layoff-cost'

describe('layoff cost', () => {
  it('reads a termination cost range', () => {
    const c = readLayoffCost('The Company expects to incur approximately $12 million to $17 million of employee termination costs, primarily cash severance. The board decided on Oct 25.')
    expect(c).toEqual({ lowUsd: 12e6, highUsd: 17e6, note: 'employee termination costs' })
  })
  it('takes the people figure out of a sentence with a total', () => {
    const c = readLayoffCost('Total restructuring charges are expected to be $40.0 million, of which $12 million to $17 million relates to severance and employee termination costs.')
    expect(c?.lowUsd).toBe(12e6)
    expect(c?.highUsd).toBe(17e6)
  })
  it('reads a single figure and "and" ranges', () => {
    expect(readLayoffCost('The Company estimates a charge of approximately $8.5 million for severance.')).toMatchObject({ lowUsd: 8.5e6, highUsd: 8.5e6, note: 'severance costs' })
    expect(readLayoffCost('Costs of between $2 and $3 million for workforce reduction severance are expected.')).toMatchObject({ lowUsd: 2e6, highUsd: 3e6 })
  })
  it('returns null when no dollar figure sits beside a cost', () => {
    expect(readLayoffCost('The board approved a reduction in force of 250 employees.')).toBeNull()
    expect(readLayoffCost('Revenue was $5 million.')).toBeNull()
  })
  it('formats and falls back', () => {
    expect(formatUsd(12e6, 17e6)).toBe('$12M–$17M')
    expect(formatUsd(850e3)).toBe('$850K')
    expect(costLines({}).cost).toBe('Cost not disclosed')
    expect(costLines({}).outplacement).toBeNull()
  })
})

describe('outplacement', () => {
  it('names the vendor when the filing does', () => {
    expect(readOutplacement('Affected employees will receive severance and outplacement services provided by Lee Hecht Harrison.')).toMatchObject({ provider: 'LHH (Lee Hecht Harrison)' })
  })
  it('flags outplacement with no vendor', () => {
    const o = readOutplacement('Employees will receive severance, benefits and outplacement assistance.')
    expect(o?.provider).toBeNull()
    expect(o?.note).toMatch(/not named/)
  })
  it('is null when absent', () => {
    expect(readOutplacement('A workforce reduction will occur.')).toBeNull()
    expect(readFilingCosts('nothing here').outplacementNote).toBeNull()
  })
})

import { alertBody } from '@/lib/warn/layoff-alert-rules'

describe('layoff alert email', () => {
  const base = { employer: 'Maplebear Inc.', employees: null, percent: null, kind: 'sec' as const, confirmed: true, inCrm: true, people: 0, warm: 0, contactsFound: 0 }
  const links = { source: null, org: null, notices: 'https://x.test/n' }
  it('shows the cost and the outplacement firm', () => {
    const html = alertBody({ ...base, costs: { costLowUsd: 12e6, costHighUsd: 17e6, costNote: 'employee termination costs', outplacementProvider: 'LHH (Lee Hecht Harrison)' } }, links)
    expect(html).toContain('$12M–$17M employee termination costs')
    expect(html).toContain('LHH (Lee Hecht Harrison)')
  })
  it('says the cost is not disclosed, and omits outplacement when there is none', () => {
    const html = alertBody(base, links)
    expect(html).toContain('Cost not disclosed')
    expect(html).not.toContain('Outplacement')
  })
})
