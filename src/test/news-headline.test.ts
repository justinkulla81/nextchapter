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

describe('isPlausibleCompany', () => {
  it('rejects the fragments the headline shapes let through, and keeps real names', async () => {
    const { isPlausibleCompany } = await import('@/lib/warn/news-headline')
    for (const bad of ['The', 'AI', 'U.S.', 'Announcing', 'Corporate Jobs', 'Mosaic to', 'Cisco posts record revenue and', "Mikel Arteta defends Arsenal's decision", 'South Fort Meade facility', 'LC4 budget proposal', 'Netherlands aims', 'Artiva to discontinue AlloNK', 'AI blamed for', 'Will AI Reorganization and', 'iconic Iowa manufacturer']) {
      expect(isPlausibleCompany(bad), bad).toBe(false)
    }
    for (const good of ['Microsoft', 'Procter & Gamble', 'Bed Bath and Beyond', 'Sucker Punch Productions', 'S&S Worldwide', 'T-Mobile', 'Hawaiian Airlines', 'EA', 'UBS', 'Italy\'s Generali']) {
      expect(isPlausibleCompany(good), good).toBe(true)
    }
  })
  it('drops a possessive from the name', async () => {
    const { readLayoffHeadline } = await import('@/lib/warn/news-headline')
    expect(readLayoffHeadline('Kroger’s lays off 3,000 employees')?.company).toBe('Kroger')
  })
  it('files a short brand name under the company it stands for', async () => {
    const { readLayoffHeadline } = await import('@/lib/warn/news-headline')
    const r = readLayoffHeadline('Amex to cut 5% of workforce as it restructures for AI')
    expect(r?.company).toBe('American Express')
    expect(r?.companyKey).toBe('american express')
  })
})
