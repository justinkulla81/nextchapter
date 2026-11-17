import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { likeKey, PUBLIC_JOB_ROW_RULES_SQL, PUBLIC_JOB_STATIC_SQL } from '@/lib/jobs/public-job-page-server'

describe('PUBLIC_JOB_ROW_RULES_SQL', () => {
  it('is the public allowlist with only the description test changed, so the similar-jobs reads keep the same rows', () => {
    const swapped = PUBLIC_JOB_STATIC_SQL.sql.replace(
      'AND length(description) >= 200',
      'AND (octet_length(description) >= 800 OR length(description) >= 200)',
    )
    expect(swapped).not.toBe(PUBLIC_JOB_STATIC_SQL.sql)
    expect(PUBLIC_JOB_ROW_RULES_SQL.sql).toBe(swapped)
    expect(PUBLIC_JOB_ROW_RULES_SQL.values).toEqual(PUBLIC_JOB_STATIC_SQL.values)
  })
})

describe('likeKey', () => {
  it('keys a job with an occupation code on the code alone', () => {
    expect(likeKey({ socCode: '13-2011.00', targetFunction: 'finance', level: 'SENIOR_IC' })).toEqual(likeKey({ socCode: '13-2011.00', targetFunction: 'ops', level: null }))
  })

  it('keys a job without one on function and level', () => {
    expect(likeKey({ socCode: null, targetFunction: 'finance', level: 'SENIOR_IC' })).toEqual({ socCode: null, targetFunction: 'finance', level: 'SENIOR_IC' })
    expect(likeKey({ targetFunction: 'finance' })).not.toEqual(likeKey({ targetFunction: 'ops' }))
  })
})
