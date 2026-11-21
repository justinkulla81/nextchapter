import { describe, expect, it } from 'vitest'
import { workspacesForStart } from '@/lib/higher-ed/demo-start-shared'

describe('a demo that starts with some offices', () => {
  const all = ['candidate', 'alumni', 'development', 'career', 'ventures', 'teaching', 'execed', 'academic', 'employer', 'admin']

  it('shows every office when every office is on, or the choice is unknown', () => {
    expect(workspacesForStart(all, 'all')).toEqual(all)
    expect(workspacesForStart(all, null)).toEqual(all)
    expect(workspacesForStart(all, 'nonsense')).toEqual(all)
  })

  it('keeps the alum, employer and Admin views and only the chosen offices', () => {
    expect(workspacesForStart(all, 'career')).toEqual(['candidate', 'career', 'employer', 'admin'])
    expect(workspacesForStart(all, 'advancement')).toEqual(['candidate', 'alumni', 'development', 'employer', 'admin'])
  })

  it('never adds an office the person could not open', () => {
    expect(workspacesForStart(['candidate'], 'career_alumni')).toEqual(['candidate'])
  })
})
