import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('react', async (orig) => ({ ...(await orig<typeof import('react')>()), cache: <T,>(fn: T) => fn }))
const findUnique = vi.fn()
const findFirst = vi.fn()
vi.mock('@/lib/prisma', () => ({ prisma: { company: { findUnique: (...a: unknown[]) => findUnique(...a), findFirst: (...a: unknown[]) => findFirst(...a) } } }))

import { getKnownEmployer } from '@/lib/warn/known-employer'

describe('getKnownEmployer', () => {
  beforeEach(() => { findUnique.mockReset(); findFirst.mockReset() })

  it('finds a plain-name employer by its slug', async () => {
    findUnique.mockResolvedValue({ id: 'c1', name: 'Acme Widgets', canonicalNameNormalized: 'acme widgets' })
    expect(await getKnownEmployer('acme-widgets')).toEqual({ id: 'c1', name: 'Acme Widgets', slug: 'acme-widgets' })
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { canonicalNameNormalized: 'acme widgets' } }))
  })

  it('finds an employer whose slug carries an id suffix', async () => {
    findUnique.mockResolvedValue(null)
    findFirst.mockResolvedValue({ id: 'cabc123def456', name: 'AT&T', canonicalNameNormalized: 'at&t' })
    expect(await getKnownEmployer('at-and-t-def456')).toEqual({ id: 'cabc123def456', name: 'AT&T', slug: 'at-and-t-def456' })
  })

  it('does not match a row whose slug differs (a guess never lands on the wrong company)', async () => {
    findUnique.mockResolvedValue(null)
    findFirst.mockResolvedValue({ id: 'cabc123def456', name: 'Other Co', canonicalNameNormalized: 'other co' })
    expect(await getKnownEmployer('something-else-def456')).toBeNull()
  })

  it('never queries for a word that is not a slug', async () => {
    expect(await getKnownEmployer('Not A Slug!')).toBeNull()
    expect(await getKnownEmployer('ab')).toBeNull()
    expect(findUnique).not.toHaveBeenCalled()
  })
})
