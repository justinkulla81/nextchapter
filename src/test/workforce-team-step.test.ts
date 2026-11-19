import { describe, expect, it } from 'vitest'
import { teamStep } from '@/lib/workforce/team-step'

const base = '/i/demo-board'

describe('launch checklist: Invite your team', () => {
  it('is not done on a fresh portal, where the claimant is the only seat', () => {
    const s = teamStep({ otherStaff: 0, staffRoles: true, base })
    expect(s.done).toBe(false)
    expect(s.href).toBe('/i/demo-board/admin/users')
  })
  it('is done once a colleague holds a seat', () => {
    expect(teamStep({ otherStaff: 1, staffRoles: true, base })).toMatchObject({ done: true, detail: '1 colleague has a seat.' })
    expect(teamStep({ otherStaff: 3, staffRoles: true, base }).detail).toBe('3 colleagues have a seat.')
  })
  it('on the free plan says inviting is part of the paid plan instead of promising it', () => {
    const s = teamStep({ otherStaff: 0, staffRoles: false, base })
    expect(s.done).toBe(false)
    expect(s.detail).toMatch(/paid plan/)
    expect(s.detail).not.toMatch(/career center/)
  })
})
