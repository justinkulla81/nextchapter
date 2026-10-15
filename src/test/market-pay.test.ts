import { describe, it, expect } from 'vitest'
import {
  annualizePay,
  comparePay,
  employerPayLevel,
  shrinkIndex,
  statesFromLocation,
  marketBasisLabel,
} from '@/lib/pay/market-pay'

describe('annualizePay', () => {
  it('keeps an annual USD range', () => {
    expect(annualizePay(150000, 200000, 'USD')).toEqual({ min: 150000, max: 200000, mid: 175000 })
  })
  it('treats a missing currency as USD and fills a one-sided range', () => {
    expect(annualizePay(null, 180000, null)).toEqual({ min: 180000, max: 180000, mid: 180000 })
  })
  it('annualises hourly and monthly pay', () => {
    expect(annualizePay(60, 80, 'USD')).toEqual({ min: 124800, max: 166400, mid: 145600 })
    expect(annualizePay(10000, 12000, 'USD')).toEqual({ min: 120000, max: 144000, mid: 132000 })
  })
  it('drops non-USD, implausible and unusably wide ranges', () => {
    expect(annualizePay(150000, 200000, 'CAD')).toBeNull()
    expect(annualizePay(5000, 50000, 'USD')).toBeNull() // 5k-50k monthly = 60k-600k: too wide
    expect(annualizePay(3_000_000, 4_000_000, 'USD')).toBeNull()
    expect(annualizePay(500, 900, 'USD')).toBeNull() // $500-900 can't be read as hourly or monthly
    expect(annualizePay(null, null, 'USD')).toBeNull()
  })
})

describe('comparePay', () => {
  it('uses a ±10% in-line band', () => {
    expect(comparePay(220000, 200000)?.verdict).toBe('in_line')
    expect(comparePay(221000, 200000)?.verdict).toBe('above')
    expect(comparePay(179000, 200000)?.verdict).toBe('below')
    expect(comparePay(0, 200000)).toBeNull()
  })
})

describe('employerPayLevel', () => {
  it('needs at least 3 jobs with posted pay', () => {
    expect(employerPayLevel([1.3, 1.4])).toEqual({ level: 'insufficient', sample: 2, ratio: null })
  })
  it('uses the median ratio', () => {
    expect(employerPayLevel([1.2, 1.3, 0.8]).level).toBe('high')
    expect(employerPayLevel([0.7, 0.85, 1.2]).level).toBe('low')
    expect(employerPayLevel([0.95, 1.05, 1.5, 0.5]).level).toBe('in_line')
  })
})

describe('shrinkIndex', () => {
  it('pulls thin samples toward 1.0', () => {
    expect(shrinkIndex(1.2, 100)).toBeCloseTo(1.1)
    expect(shrinkIndex(1.2, 0)).toBe(1)
  })
})

describe('statesFromLocation', () => {
  it('reads city, state codes', () => {
    expect(statesFromLocation('Austin, TX')).toEqual({ states: ['TX'], isRemote: false })
    expect(statesFromLocation('New York, NY 10001')).toEqual({ states: ['NY'], isRemote: false })
    expect(statesFromLocation('Portland, OR; Denver, CO')).toEqual({ states: ['OR', 'CO'], isRemote: false })
  })
  it('reads state names and bare big cities', () => {
    expect(statesFromLocation('Remote - California').states).toEqual(['CA'])
    expect(statesFromLocation('Remote - California').isRemote).toBe(true)
    expect(statesFromLocation('San Francisco').states).toEqual(['CA'])
    expect(statesFromLocation('Washington, DC').states).toEqual(['DC'])
  })
  it('does not read India as Indiana or a foreign code as a state', () => {
    expect(statesFromLocation('Remote').states).toEqual([])
    expect(statesFromLocation('United States').states).toEqual([])
    expect(statesFromLocation(null)).toEqual({ states: [], isRemote: false })
  })
})

describe('marketBasisLabel', () => {
  it('describes the match', () => {
    expect(marketBasisLabel('state:CA', 120)).toBe('Same function and level in CA (120 posted salaries)')
    expect(marketBasisLabel('national_adjusted:TX', 40)).toContain('adjusted for TX')
    expect(marketBasisLabel(null, 3)).toBeNull()
  })
})
