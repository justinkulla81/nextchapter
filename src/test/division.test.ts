import { describe, expect, it } from 'vitest'
import { firstDivision, readDivision } from '@/lib/warn/division'

describe('readDivision', () => {
  it('reads the name before "division"', () => {
    expect(readDivision('Microsoft cuts jobs in its Xbox division')).toBe('Xbox')
    expect(readDivision('Boeing - Defense Division')).toBe('Defense')
    expect(readDivision('Google lays off 100 in Google Cloud division')).toBe('Google Cloud')
  })
  it('drops the company possessive and "the"', () => {
    expect(readDivision("Meta's Reality Labs division sheds 600")).toBe('Reality Labs')
    expect(readDivision('Cuts hit the Consumer Banking division')).toBe('Consumer Banking')
  })
  it('reads "Division of"', () => {
    expect(readDivision('Acme Corp, Division of Acme Medical Systems')).toBe('Acme Medical Systems')
  })
  it('reads a business unit', () => {
    expect(readDivision('Intel to cut jobs at its Networking Business Unit')).toBe('Networking')
  })
  it('ignores text that names no division', () => {
    expect(readDivision('Amazon lays off 14,000 corporate employees')).toBeNull()
    expect(readDivision('layoffs in a division of the company')).toBeNull()
    expect(readDivision('the division')).toBeNull()
    expect(readDivision('Division of Workforce Services notice')).toBe('Workforce Services')
    expect(readDivision(null)).toBeNull()
  })
  it('takes the first headline that names one', () => {
    expect(firstDivision(['Nike cuts jobs', 'Nike Converse division layoffs'])).toBe('Nike Converse')
  })
})
