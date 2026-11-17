import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/jobs/public-job-page-server', () => ({ similarJobsAtCompany: async () => [] }))

import { employerKeys } from '@/lib/higher-ed/campus-jobs'

describe('employerKeys', () => {
  it('normalizes the college name and extra employer names, without duplicates', () => {
    const keys = employerKeys('Carnegie Mellon University', ['carnegie mellon university', 'Carnegie Mellon University - School of Design'])
    expect(keys[0]).toBe('carnegie mellon university')
    expect(keys).toHaveLength(2)
  })
})
