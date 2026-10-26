import { describe, expect, it } from 'vitest'
import { extractCompanies } from './sponsors'

describe('extractCompanies', () => {
  it('finds the employer in a hiring-event title', () => {
    expect(extractCompanies('Cooper Standard Hiring Event').employers).toEqual(['Cooper Standard'])
    expect(extractCompanies('Caltrans – Engineering Career Event').employers).toEqual(['Caltrans'])
    expect(extractCompanies('Hiring Event with Acme Health').employers).toEqual(['Acme Health'])
  })
  it('ignores generic leads', () => {
    expect(extractCompanies('Spring Career Fair').employers).toEqual([])
    expect(extractCompanies('Virtual Hiring Event').employers).toEqual([])
  })
  it('finds sponsors', () => {
    expect(extractCompanies('Small Business Expo', 'Presented by First Horizon Bank and Delta Air Lines. Free entry.').sponsors).toEqual(['First Horizon Bank', 'Delta Air Lines'])
    expect(extractCompanies('Founders Night', 'Sponsors: Acme Corp, Globex & Initech.').sponsors).toEqual(['Acme Corp', 'Globex', 'Initech'])
  })
})
