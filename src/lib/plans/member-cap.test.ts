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
  it('FREE no longer caps who joins (owner decision 2026-11-17: staff see only the first 5)', async () => {
    state.held = 100000
    expect((await heldMemberRoom('i', 'FREE', 1)).allowed).toBe(true)
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
