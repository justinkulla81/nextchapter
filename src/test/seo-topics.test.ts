import { describe, expect, it } from 'vitest'
import { INDUSTRIES, JOB_FUNCTIONS, associationSlug, bucketFromIndustryText, bucketFromWarn, functionBySlug, industryBySlug, topicSlug } from '@/lib/seo/topics'

describe('topic slugs', () => {
  it('makes clean slugs', () => {
    expect(topicSlug('Venture Capital & Private Equity')).toBe('venture-capital-and-private-equity')
    expect(topicSlug('Hospitality, Travel & Food Service')).toBe('hospitality-travel-and-food-service')
    expect(topicSlug('Data & Analytics')).toBe('data-and-analytics')
  })
  it('has unique slugs that round-trip', () => {
    for (const list of [INDUSTRIES, JOB_FUNCTIONS]) expect(new Set(list.map((x) => x.slug)).size).toBe(list.length)
    expect(industryBySlug('insurance')?.name).toBe('Insurance')
    expect(functionBySlug('data-and-analytics')?.name).toBe('Data & Analytics')
    expect(industryBySlug('other')).toBeNull()
  })
  it('strips a trailing parenthetical from an organizer', () => {
    expect(associationSlug('Association of National Advertisers (ANA)')).toBe('association-of-national-advertisers')
  })
})

describe('industry mapping', () => {
  it('maps crawler codes and bucket names', () => {
    expect(bucketFromIndustryText('technology')).toBe('Technology & Software')
    expect(bucketFromIndustryText('Insurance')).toBe('Insurance')
    expect(bucketFromIndustryText('mystery')).toBeNull()
  })
  it('maps WARN text, keeping ambiguous sectors unmapped', () => {
    expect(bucketFromWarn('62 Healthcare and Social Assistance', 'X Clinic', null)).toBe('Healthcare & Hospital Systems')
    expect(bucketFromWarn('tech: Finance', 'Acme', null)).toBe('Technology & Software')
    expect(bucketFromWarn('54 (NAICS 541512)', 'Acme', null)).toBe('Technology & Software')
    expect(bucketFromWarn('52 Finance and Insurance', 'Pioneer Mutual Insurance Co', null)).toBe('Insurance')
    expect(bucketFromWarn('52 Finance and Insurance', 'First Bank', null)).toBe('Financial Services & Banking')
    expect(bucketFromWarn('56 Administrative and Support', 'Acme', null)).toBeNull()
    expect(bucketFromWarn(null, 'Acme', 'Education & EdTech')).toBe('Education & EdTech')
    expect(bucketFromWarn('N/A', 'Acme', null)).toBeNull()
  })
})
