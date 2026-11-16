import { describe, expect, it, vi, beforeEach } from 'vitest'

const queryRaw = vi.fn()
const findMany = vi.fn()
const findUnique = vi.fn()
const upsert = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a), company: { findMany: (...a: unknown[]) => findMany(...a), findUnique: (...a: unknown[]) => findUnique(...a), upsert: (...a: unknown[]) => upsert(...a) } } }))
vi.mock('@/lib/db/heavy', () => ({ sharedLoad: (_k: string, _s: number, load: () => Promise<unknown>) => load() }))

import { loadCompanyIndex, matchOrCreateCompanyForEmployer } from '@/lib/warn/company-match'

describe('company index from the shared cache', () => {
  beforeEach(() => {
    queryRaw.mockReset(); findMany.mockReset(); findUnique.mockReset(); upsert.mockReset()
  })

  it('joins the cached parts and adds companies created since, the newer name winning', async () => {
    queryRaw.mockResolvedValueOnce([{ id: 'a', name: 'Acme' }]).mockResolvedValue([])
    findMany.mockResolvedValueOnce([{ id: 'b', name: 'Beta Labs' }, { id: 'a', name: 'Acme Corp' }])
    const index = await loadCompanyIndex()
    expect(queryRaw).toHaveBeenCalledTimes(6)
    expect(index).toEqual(expect.arrayContaining([{ id: 'a', name: 'Acme Corp' }, { id: 'b', name: 'Beta Labs' }]))
    expect(index).toHaveLength(2)
  })

  it('reads the table fresh once when the cached match no longer exists', async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'new' })
    findMany.mockResolvedValueOnce([{ id: 'new', name: 'Gamma Inc' }])
    const r = await matchOrCreateCompanyForEmployer('Gamma Inc', [{ id: 'gone', name: 'Gamma' }])
    expect(r).toMatchObject({ companyId: 'new', status: 'MATCHED' })
    expect(findMany).toHaveBeenCalledTimes(1)
  })
})
