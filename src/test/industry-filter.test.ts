import { describe, expect, it } from 'vitest'
import { buildSearchIndex, industryKeep } from '@/lib/jobs/board-search-index'
import { SEGMENT_GROUPS, SEGMENTS, segmentMatcher, segmentsOf } from '@/lib/segments/defs'
import { INDUSTRY_GROUP_ORDER, INDUSTRY_OPTIONS, INDUSTRY_SLUGS } from '@/lib/segments/industry-options'

// The portal's industry filter must give the member the public industry page's list: the same rules, fed the same facts.

interface Job { id: string; title: string; company: string; industry: string | null; postingType?: string | null; sourceCategory?: string | null; sector?: string | null; reqTags?: string | null }

const JOBS: Job[] = [
  { id: 'a1', title: 'Pharmacist', company: 'Albertsons Companies', industry: 'healthcare' },
  { id: 'a2', title: 'Store Director', company: 'Walmart', industry: 'consumer' },
  { id: 'a3', title: 'Merchandising Analyst', company: 'Acme Stores Inc', industry: 'consumer' },
  { id: 'a4', title: 'Controller', company: 'General Hospital', industry: 'healthcare' },
  { id: 'a5', title: 'Project Executive', company: 'Turner Construction Company', industry: 'real_estate' },
  { id: 'a6', title: 'Structural Engineer', company: 'WSP USA', industry: 'engineering' },
  { id: 'a7', title: 'Superintendent', company: 'Plain Co', industry: null },
  { id: 'a8', title: 'Software Engineer', company: 'Homes Builders LLC', industry: 'real_estate' },
  { id: 'a9', title: 'Store Manager', company: 'Kroger', industry: 'consumer', postingType: 'recruiter_search' },
  { id: 'b1', title: 'Restaurant General Manager', company: 'Local Bistro', industry: 'consumer' },
  { id: 'b2', title: 'Analyst', company: 'Big Bank', industry: 'financial_services' },
  { id: 'b3', title: 'Sales Associate', company: 'Staffing Partners', industry: 'consumer', sourceCategory: 'search_firm' },
]

const facts = (j: Job) => ({ id: j.id, title: j.title, companyName: j.company, industry: j.industry, socTitle: null, workArrangement: null, locationCity: null, locationState: 'TX', states: null, skills: null, postingType: j.postingType ?? null })
const light = (j: Job) => ({ id: j.id, title: j.title, companyName: j.company, sourceCategory: j.sourceCategory ?? null, employerSector: j.sector ?? null, requirementTags: j.reqTags ?? null })
const segmentFacts = (j: Job) => ({ title: j.title, company: j.company, industry: j.industry, reqTags: j.reqTags ?? null, postingType: j.postingType ?? null, sourceCategory: j.sourceCategory ?? null, sector: j.sector ?? null })

describe('industry filter', () => {
  const index = buildSearchIndex(JOBS.map(facts))

  it('gives the same answer as the public industry page rule, for every industry and job', () => {
    for (const seg of SEGMENTS) {
      const keep = industryKeep(seg.slug, index)!
      for (const j of JOBS) {
        expect(keep(light(j)), `${seg.slug} / ${j.id}`).toBe(segmentsOf(segmentFacts(j)).includes(seg.slug))
      }
    }
  })

  it('reads the industry code and posting type from the index, which the light rows do not carry', () => {
    expect(industryKeep('healthcare', index)!(light(JOBS[3]))).toBe(true) // code only
    expect(industryKeep('retail', index)!(light(JOBS[8]))).toBe(false) // Kroger, but a search firm's posting
    expect(industryKeep('construction', index)!(light(JOBS[4]))).toBe(true) // employer list, name with a suffix
    expect(industryKeep('construction', index)!(light(JOBS[7]))).toBe(false) // excluded title ("software")
  })

  it('judges a job the index has not seen on its title and company alone', () => {
    const keep = industryKeep('construction', index)!
    expect(keep({ id: 'new', title: 'Construction Manager', companyName: 'Anyone', sourceCategory: null, employerSector: null, requirementTags: null })).toBe(true)
    expect(industryKeep('healthcare', index)!({ id: 'new', title: 'Controller', companyName: 'General Hospital', sourceCategory: null, employerSector: null, requirementTags: null })).toBe(false)
  })

  it('is null for a slug that is not an industry', () => {
    expect(industryKeep('nope', index)).toBeNull()
    expect(segmentMatcher('nope')).toBeNull()
  })

  it('has a dropdown list (and a redirect list) equal to the segment definitions', () => {
    expect(INDUSTRY_OPTIONS.map((o) => ({ slug: o.slug, name: o.name, group: o.group }))).toEqual(SEGMENTS.map((s) => ({ slug: s.slug, name: s.name, group: s.group })))
    expect([...INDUSTRY_GROUP_ORDER]).toEqual([...SEGMENT_GROUPS])
    expect(INDUSTRY_SLUGS.size).toBe(SEGMENTS.length)
  })
})
