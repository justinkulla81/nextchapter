import { describe, expect, it } from 'vitest'
import { classifyKind, isNoise, proScore, trackOf } from './classify'

describe('local event classification', () => {
  it('finds job fairs and entrepreneur kinds', () => {
    expect(classifyKind('Spring Career Fair for Professionals')).toBe('JOB_FAIR')
    expect(classifyKind('Starting a Business 101')).toBe('STARTUP_WORKSHOP')
    expect(classifyKind('SCORE mentoring session for small business owners')).toBe('SMALL_BUSINESS_COUNSELING')
    expect(classifyKind('Rapid Response workshop for laid off workers')).toBe('RAPID_RESPONSE')
    expect(classifyKind('Bingo night')).toBe('OTHER')
  })
  it('routes entrepreneur kinds to the entrepreneur track', () => {
    expect(trackOf('PITCH')).toBe('ENTREPRENEUR')
    expect(trackOf('JOB_FAIR')).toBe('JOBS')
  })
  it('scores hourly fairs low and professional ones high', () => {
    expect(proScore('Warehouse and CDL driver hiring day', 'HIRING_EVENT')).toBeLessThan(35)
    expect(proScore('Manager and director level career fair', 'JOB_FAIR')).toBeGreaterThan(60)
    expect(proScore('Craft fair and holiday market', 'OTHER')).toBeLessThan(35)
  })
  it('drops closures, library drop-ins and governance meetings', () => {
    expect(isNoise('Closed in Observance of Thanksgiving Holiday')).toBe(true)
    expect(isNoise('OhioMeansJobs at the Library–Dover')).toBe(true)
    expect(isNoise('Workforce Board committee meeting')).toBe(true)
    expect(isNoise('Spring Career Fair')).toBe(false)
  })
})
