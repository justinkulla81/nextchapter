import { describe, expect, it } from 'vitest'
import { userTypeFromCrm } from '@/lib/admin/visitor-user-type'

describe('userTypeFromCrm', () => {
  it('types a job seeker as a candidate even with a higher-ed role and a university employer', () => {
    expect(userTypeFromCrm(['HIGHER_ED_DEVELOPMENT', 'JOB_SEEKER'], ['EMPLOYER', 'UNIVERSITY'])).toBe('Candidate')
  })
  it('still types a higher-ed contact who is not a job seeker as higher ed', () => {
    expect(userTypeFromCrm(['HIGHER_ED_CAREER'], ['UNIVERSITY'])).toBe('Higher ed')
  })
})
