import { describe, expect, it } from 'vitest'
import { pickSimilarJobs, type SimilarJob } from '@/lib/jobs/public-job-page-server'

const j = (id: string, title: string, city: string | null = 'Houston', state: string | null = 'TX'): SimilarJob => ({ id, title, locationCity: city, locationState: state })

describe('pickSimilarJobs', () => {
  it('keeps one link per title and place and respects the limit', () => {
    const rows = [j('a', 'Nurse'), j('b', 'nurse '), j('c', 'Nurse', 'Dallas'), j('d', 'Analyst'), j('e', 'Manager'), j('f', 'Director')]
    const out = pickSimilarJobs(rows, 3)
    expect(out.map((r) => r.id)).toEqual(['a', 'c', 'd'])
  })
  it('returns an empty list for no rows', () => {
    expect(pickSimilarJobs([], 6)).toEqual([])
  })
})
