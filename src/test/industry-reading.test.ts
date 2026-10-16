import { describe, expect, it } from 'vitest'
import { jobIndustryBucket, memberIndustryBuckets, readMemberIndustries } from '@/lib/profile/industry-reading'

describe('reading industries', () => {
  it('"Venture capital / AI startups" is VC/PE plus technology, and uncertain', () => {
    expect(readMemberIndustries('Venture capital / AI startups')).toEqual({ buckets: ['Venture Capital & Private Equity', 'Technology & Software'], uncertain: true })
  })
  it('whole words only: "retail" is not "ai"', () => {
    expect(readMemberIndustries('Retail').buckets).toEqual(['Retail & E-commerce'])
  })
  it('one clear industry is certain', () => {
    expect(readMemberIndustries('Higher Education')).toEqual({ buckets: ['Education & EdTech'], uncertain: false })
  })
  it('a confirmed choice wins', () => {
    expect(memberIndustryBuckets({ industryBuckets: ['Technology & Software'], industryContext: 'Venture capital / AI startups' })).toEqual(['Technology & Software'])
  })
  it('job crawler keys map to the same buckets', () => {
    expect(jobIndustryBucket('financial_services')).toBe('Financial Services & Banking')
    expect(jobIndustryBucket('life_sciences')).toBe('Pharmaceuticals & Biotech')
    expect(jobIndustryBucket('consumer')).toBeNull()
  })
})
