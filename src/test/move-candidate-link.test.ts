import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const findFirst = vi.fn()
const update = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { crmPerson: { findFirst: (a: unknown) => findFirst(a), update: (a: unknown) => update(a) } } }))

import { moveCrmPersonToCandidate } from '@/lib/crm/move-candidate-link'

beforeEach(() => {
  findFirst.mockReset()
  update.mockReset()
})

describe('moveCrmPersonToCandidate', () => {
  it('moves the leftover profile\'s CRM person onto the registered profile', async () => {
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'lead' })
    expect(await moveCrmPersonToCandidate('stale', 'real')).toBe(true)
    expect(findFirst).toHaveBeenNthCalledWith(1, { where: { candidateId: 'real' }, select: { id: true } })
    expect(findFirst).toHaveBeenNthCalledWith(2, { where: { candidateId: 'stale', deletedAt: null }, select: { id: true } })
    expect(update).toHaveBeenCalledWith({ where: { id: 'lead' }, data: { candidateId: 'real' } })
  })

  it('leaves everything alone when the registered profile already has its own CRM person', async () => {
    findFirst.mockResolvedValueOnce({ id: 'already' })
    expect(await moveCrmPersonToCandidate('stale', 'real')).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('does nothing when the leftover has no CRM person', async () => {
    findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    expect(await moveCrmPersonToCandidate('stale', 'real')).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })
})
