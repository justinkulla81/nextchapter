import { describe, expect, it } from 'vitest'
import { can } from '@/lib/institution/permissions'

describe('institution permissions', () => {
  it('lets career, employer and alumni staff post jobs but not development or viewers', () => {
    expect(can('CAREER_SERVICES', 'post_jobs')).toBe(true)
    expect(can('EMPLOYER_RELATIONS', 'post_jobs')).toBe(true)
    expect(can('ALUMNI_RELATIONS', 'post_jobs')).toBe(true)
    expect(can('DEVELOPMENT', 'post_jobs')).toBe(false)
    expect(can('VIEWER', 'post_jobs')).toBe(false)
  })
  it('keeps target companies to the people who work with employers', () => {
    expect(can('ALUMNI_RELATIONS', 'manage_target_companies')).toBe(false)
    expect(can('EMPLOYER_RELATIONS', 'manage_target_companies')).toBe(true)
  })
  it('lets everyone view', () => {
    for (const r of ['INSTITUTION_ADMIN', 'DEVELOPMENT', 'VIEWER'] as const) expect(can(r, 'view')).toBe(true)
  })
})
