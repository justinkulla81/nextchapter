import { describe, expect, it } from 'vitest'
import { againstLastSalaryLine, costsFor, homeLine, priceLine, rentLine, valueInHomeDollars, worthLine, type AreaCosts } from '@/lib/market/area-costs'

const columbus: AreaCosts = { name: 'Columbus, OH', rent: 1274, home: 300800, rpp: 95.5 }
const raleigh: AreaCosts = { name: 'Raleigh, NC', rent: 1573, home: 418400, rpp: 98.2 }
const micro: AreaCosts = { name: 'Alamosa, CO', rent: 882, home: 217700 }

describe('area costs', () => {
  it('finds the metro area, then the state, then the nation', () => {
    expect(costsFor({ metroCode: '39580' })?.name).toContain('Raleigh')
    expect(costsFor({ metroCode: '00000', stateFips: '37' })?.name).toBe('North Carolina')
    expect(costsFor({})?.name).toBe('United States')
  })
  it('converts a salary into the home place’s dollars', () => {
    expect(valueInHomeDollars(100000, columbus, raleigh)).toBe(97300)
    expect(valueInHomeDollars(100000, raleigh, columbus)).toBe(102800)
  })
  it('says nothing about value without both price parities', () => {
    expect(valueInHomeDollars(100000, columbus, micro)).toBeNull()
    expect(worthLine(100000, columbus, micro)).toBeNull()
    expect(priceLine(columbus, micro)).toBeNull()
  })
  it('words the comparison plainly and names the base', () => {
    expect(rentLine(columbus, raleigh)).toBe('Typical rent $1,573 a month, 23% higher than in Columbus, OH.')
    expect(homeLine(columbus, raleigh)).toBe('Typical home value $418,400, 39% higher than in Columbus, OH.')
    expect(priceLine(columbus, raleigh)).toBe('Everyday prices run about 3% higher than in Columbus, OH.')
    expect(worthLine(128000, columbus, raleigh)).toBe('$128,000 in Raleigh, NC covers about what $124,500 does in Columbus, OH.')
  })
  it('still shows rent and home value where there is no comparison', () => {
    expect(rentLine(null, raleigh)).toBe('Typical rent $1,573 a month.')
    expect(homeLine(columbus, micro)).toContain('lower than in Columbus, OH')
  })
  it('compares a place’s pay, in home dollars, with the last salary', () => {
    expect(againstLastSalaryLine(128000, 120000, columbus, raleigh)).toBe('That is 4% more than your last salary of $120,000.')
    expect(againstLastSalaryLine(100000, 120000, columbus, raleigh)).toBe('That is 19% less than your last salary of $120,000.')
    expect(againstLastSalaryLine(128000, 0, columbus, raleigh)).toBeNull()
  })
  it('never calls the price figures a forecast or a guarantee', () => {
    expect(priceLine(columbus, raleigh)).not.toMatch(/will|guarantee|forecast/i)
  })
})
