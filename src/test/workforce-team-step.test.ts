import { describe, expect, it } from 'vitest'
import { teamSeatWhere, teamStep } from '@/lib/workforce/team-step'

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

// Applies teamSeatWhere's filter to seat rows the way the database would (null userId never equals the viewer).
type Seat = { id: string; userId: string | null; invitedEmail: string; revokedAt: Date | null }
function countTeam(seats: Seat[], w: ReturnType<typeof teamSeatWhere>) {
  const founding = w.AND.find((c): c is { id: { not: string } } => 'id' in c)?.id.not
  return seats.filter((s) => {
    if (s.revokedAt) return false
    if (s.userId !== null && s.userId === (w.AND[0] as { OR: [unknown, { userId: { not: string } }] }).OR[1].userId.not) return false
    if (s.invitedEmail.toLowerCase() === (w.AND[1] as { invitedEmail: { not: string } }).invitedEmail.not.toLowerCase()) return false
    return s.id !== founding
  }).length
}

describe('which seats count as the team', () => {
  const claimant: Seat = { id: 'seat_admin', userId: 'u_claimant', invitedEmail: 'director@board.example.com', revokedAt: null }
  const colleague: Seat = { id: 'seat_2', userId: null, invitedEmail: 'casemanager@board.example.com', revokedAt: null }
  const owner = { institutionId: 'inst', userId: 'u_claimant', email: 'director@board.example.com', viewerSeats: 1, foundingAdminId: null }
  const support = { institutionId: 'inst', userId: 'u_support', email: 'support@launchyournextchapter.com', viewerSeats: 0, foundingAdminId: 'seat_admin' }

  it('the administrator on a fresh portal sees no team', () => {
    expect(countTeam([claimant], teamSeatWhere(owner))).toBe(0)
  })
  it('NextChapter support viewing a fresh portal also sees no team', () => {
    expect(countTeam([claimant], teamSeatWhere(support))).toBe(0)
  })
  it('both see an invited colleague, and a revoked one does not count', () => {
    expect(countTeam([claimant, colleague], teamSeatWhere(owner))).toBe(1)
    expect(countTeam([claimant, colleague], teamSeatWhere(support))).toBe(1)
    expect(countTeam([claimant, { ...colleague, revokedAt: new Date() }], teamSeatWhere(support))).toBe(0)
  })
  it('a seat-holding viewer never drops the founding admin as well as themselves', () => {
    expect(teamSeatWhere({ ...owner, foundingAdminId: 'seat_admin' }).AND).toHaveLength(2)
  })
})
