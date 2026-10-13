import { describe, it, expect } from 'vitest'
import { readLayoffHeadline } from '@/lib/warn/news-headline'

describe('readLayoffHeadline', () => {
  it('reads the plain shapes', () => {
    expect(readLayoffHeadline('Disney lays off around 300 employees')).toMatchObject({ company: 'Disney', employees: 300 })
    expect(readLayoffHeadline('Flock Safety Plans to Cut 270 Jobs Amid AI Camera Scrutiny')).toMatchObject({ company: 'Flock Safety', employees: 270 })
  })

  it('keeps hedge words out of the company name', () => {
    expect(readLayoffHeadline('Netflix Reportedly Preparing to Cut Around 800 Jobs')).toMatchObject({ company: 'Netflix', companyKey: 'netflix', employees: 800 })
    expect(readLayoffHeadline('Netflix prepares layoffs affecting about 5% of staff')).toBeNull()
    expect(readLayoffHeadline('Acme Corp Expected to Lay Off 1,200 Workers')).toMatchObject({ company: 'Acme Corp', employees: 1200 })
    expect(readLayoffHeadline('Globex is now preparing to cut 40 positions')).toMatchObject({ company: 'Globex', employees: 40 })
  })

  it('still skips descriptions that are not a company name', () => {
    expect(readLayoffHeadline('Banking giant cuts 500 jobs')).toBeNull()
  })
})
