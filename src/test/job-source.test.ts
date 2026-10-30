import { describe, expect, it } from 'vitest'
import { classifyJobSource } from '@/lib/admin/job-source'

describe('classifyJobSource', () => {
  it('names the big aggregators by apply-link host', () => {
    expect(classifyJobSource('https://jooble.org/jdp/123', 'aggregator')).toBe('Jooble')
    expect(classifyJobSource('https://www.adzuna.com/details/1', 'aggregator')).toBe('Adzuna')
    expect(classifyJobSource('https://www.usajobs.gov:443/job/1', 'government')).toBe('USAJobs')
  })
  it('lumps other aggregator-tagged boards together', () => {
    expect(classifyJobSource('https://www.careerjet.com/x', 'aggregator')).toBe('Other aggregator')
  })
  it('treats everything else as direct', () => {
    expect(classifyJobSource('https://boards.greenhouse.io/acme/1', 'employer')).toBe('Direct')
    expect(classifyJobSource(null, null)).toBe('Direct')
  })
})
