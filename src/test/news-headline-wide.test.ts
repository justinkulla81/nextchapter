import { describe, it, expect } from 'vitest'
import { readLayoffHeadline } from '@/lib/warn/news-headline'

const name = (h: string) => readLayoffHeadline(h)?.company ?? null

describe('readLayoffHeadline: wider shapes', () => {
  it('reads a share of the workforce', () => {
    expect(name('Bumble to cut 30% of workforce, about 240 employees')).toBe('Bumble')
    expect(name('Bumble lays off 30% of its staff')).toBe('Bumble')
    expect(name('Meta cuts 5% of staff in latest round')).toBe('Meta')
  })

  it('reads thousands and hundreds without a number', () => {
    expect(name('Intel to lay off thousands as part of restructuring')).toBe('Intel')
    expect(name('Oracle cuts hundreds of jobs in cloud unit')).toBe('Oracle')
  })

  it('does not read money or rates as people', () => {
    expect(readLayoffHeadline('Oracle cuts hundreds of millions in costs')).toBeNull()
    expect(readLayoffHeadline('Fed cuts rates by 25 basis points')).toBeNull()
    expect(readLayoffHeadline('Starbucks cuts prices on 30% of its menu')).toBeNull()
  })

  it('reads a large part of the team, quoted or not', () => {
    expect(name("Airtable lays off a large part of the Airtable team")).toBe('Airtable')
    expect(name("Airtable's new owner is laying off a 'large part' of its team")).toBe('Airtable')
  })

  it("puts an owner's layoff at the company it owns", () => {
    expect(name("Airtable's new owner is laying off a 'large part' of its team")).toBe('Airtable')
    expect(name("Bending Spoons lays off large part of Airtable after $1.28 billion acquisition")).toBe('Airtable')
    expect(name('Vista lays off 20% of Acme following takeover')).toBe('Acme')
  })

  it('reads a headcount reduction', () => {
    expect(readLayoffHeadline('Salesforce reduces headcount by 4,000 as AI takes over support')).toMatchObject({ company: 'Salesforce', employees: 4000 })
    expect(name('Zoom to reduce its workforce by 10%')).toBe('Zoom')
  })

  it('keeps reading the original shapes', () => {
    expect(readLayoffHeadline('Disney lays off around 300 employees')).toMatchObject({ company: 'Disney', employees: 300 })
    expect(name('Bumble announces layoffs')).toBe('Bumble')
  })

  it('leaves descriptions and unrelated headlines alone', () => {
    expect(readLayoffHeadline('Banking giant cuts 30% of workforce')).toBeNull()
    expect(readLayoffHeadline('Tech startup to cut thousands of jobs')).toBeNull()
    expect(readLayoffHeadline('Why layoffs are changing the job market')).toBeNull()
  })
})
