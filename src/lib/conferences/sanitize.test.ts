import { describe, expect, it } from 'vitest'
import { missingFields, sanitizeExtraction } from './sanitize'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'

const base = 'https://conf.example.com/2027'

describe('sanitizeExtraction', () => {
  it('keeps only closed-vocabulary tags and valid values', () => {
    const e = sanitizeExtraction({
      name: ' HR Tech ', startDate: '2027-09-14', endDate: '2027-09-16', format: 'HYBRID', state: 'nv', country: 'us', costLow: 495, costHigh: 100,
      industries: [INDUSTRY_BUCKET_NAMES[0], 'Made Up'], functions: ['Not A Function'], seniorities: ['SENIOR', 'GOD'],
    }, base)
    expect(e.name).toBe('HR Tech')
    expect(e.format).toBe('HYBRID')
    expect(e.state).toBe('NV')
    expect(e.country).toBe('US')
    expect(e.costHigh).toBe(495) // high below low is lifted to low
    expect(e.industries).toEqual([INDUSTRY_BUCKET_NAMES[0]])
    expect(e.functions).toEqual([])
    expect(e.seniorities).toEqual(['SENIOR'])
  })
  it('drops bad dates and an end without a start', () => {
    const e = sanitizeExtraction({ startDate: 'September', endDate: '2027-09-16' }, base)
    expect(e.startDate).toBeNull()
    expect(e.endDate).toBeNull()
  })
  it('resolves relative opportunity links, rejects bad types and javascript: links, dedupes', () => {
    const e = sanitizeExtraction({
      opportunities: [
        { type: 'CALL_FOR_SPEAKERS', title: 'Speak', url: '/speak', deadline: '2027-02-01' },
        { type: 'CALL_FOR_SPEAKERS', title: 'speak', url: '/speak' },
        { type: 'BOGUS', title: 'x' },
        { type: 'AWARD', title: 'Award', url: 'javascript:alert(1)' },
      ],
    }, base)
    expect(e.opportunities).toHaveLength(2)
    expect(e.opportunities[0].url).toBe('https://conf.example.com/speak')
    expect(e.opportunities[1].url).toBeNull()
  })
  it('reports what is missing without blocking', () => {
    expect(missingFields(sanitizeExtraction({}, base))).toEqual(['name', 'dates', 'location', 'industries', 'functions'])
    expect(missingFields(sanitizeExtraction({ name: 'X', format: 'VIRTUAL', startDate: '2027-01-01', industries: [INDUSTRY_BUCKET_NAMES[0]], functions: ['Sales'] }, base))).toEqual([])
  })
})
