import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
const state = vi.hoisted(() => ({ held: 0, events: [] as string[] }))
vi.mock('@/lib/prisma', () => ({ prisma: { institutionMember: { count: async () => state.held } } }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: (_id: string, e: string) => state.events.push(e) }))

import { heldMemberRoom, recordCapReached } from './member-cap'

beforeEach(() => {
  state.held = 0
  state.events.length = 0
})

describe('heldMemberRoom', () => {
  it('FREE at 49, 50 and 51 held when adding one', async () => {
    state.held = 49
    expect((await heldMemberRoom('i', 'FREE', 1)).allowed).toBe(true)
    state.held = 50
    expect((await heldMemberRoom('i', 'FREE', 1)).allowed).toBe(false)
    state.held = 51
    const r = await heldMemberRoom('i', 'FREE', 1)
    expect(r.allowed).toBe(false)
    expect(r.left).toBe(0)
  })
  it('PAID never counts and never blocks', async () => {
    state.held = 100000
    expect((await heldMemberRoom('i', 'PAID', 5000)).allowed).toBe(true)
  })
  it('records entitlement_cap_reached', () => {
    recordCapReached('u', 'riverside', 50, 'import')
    expect(state.events).toEqual(['entitlement_cap_reached'])
  })
})
