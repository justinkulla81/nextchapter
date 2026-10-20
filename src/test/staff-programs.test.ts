import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

const m = await import('@/lib/employer/staff-programs')

const form = (o: Record<string, string>) => {
  const f = new FormData()
  for (const [k, v] of Object.entries(o)) f.set(k, v)
  return f
}

describe('Growth internal roles', () => {
  it('stay off the open board: their own status, never approved', () => {
    expect(m.INTERNAL_ROLE_STATUS).not.toBe('approved')
  })
  it('needs a title and a real apply link', () => {
    expect(m.readInternalRole(form({ title: '' }))).toEqual({ error: 'Give the role a title.' })
    expect('error' in m.readInternalRole(form({ title: 'Analyst', applyUrl: 'javascript:alert(1)' }))).toBe(true)
    expect(m.readInternalRole(form({ title: ' Analyst ', applyUrl: 'https://jobs.example.com/1' }))).toEqual({ title: 'Analyst', location: null, description: null, applyUrl: 'https://jobs.example.com/1' })
  })
  it('reads the apply link back out of the unique url key', () => {
    expect(m.applyLinkOf('https://jobs.example.com/1#nc-internal-abc')).toBe('https://jobs.example.com/1')
    expect(m.applyLinkOf('https://launchyournextchapter.com/dashboard/internal-roles#nc-internal-abc')).toBeNull()
    expect(m.applyLinkOf('https://boards.greenhouse.io/x/1')).toBeNull()
  })
})

describe('Learning courses', () => {
  it('splits skills and checks the link', () => {
    expect(m.readCourse(form({ title: 'SQL basics', skills: 'SQL, , Tableau ', covered: 'Fully covered' }))).toMatchObject({ title: 'SQL basics', skills: ['SQL', 'Tableau'], covered: 'Fully covered', url: null })
    expect('error' in m.readCourse(form({ title: 'X', url: 'not a url' }))).toBe(true)
  })
})
