import { describe, it, expect, vi, beforeEach } from 'vitest'

const { findMany, mergePersonRecords } = vi.hoisted(() => ({ findMany: vi.fn(), mergePersonRecords: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: { crmPerson: { findMany } } }))
vi.mock('@/lib/admin/auth', () => ({ requireAdmin: async () => ({ email: 'admin@example.com' }) }))
vi.mock('@/lib/crm/merge-person', () => ({ mergePersonRecords }))
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: vi.fn() }))
vi.mock('next/cache', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/cache')>()), revalidatePath: vi.fn() }))
// Imported by actions.ts but unused by the merge path; stubbed so the module
// loads without their own server-side dependencies.
vi.mock('@/lib/candidates/invite', () => ({}))
vi.mock('@/lib/google/gmail', () => ({}))
vi.mock('@/lib/google/connection', () => ({}))
vi.mock('@/lib/crm/sync', () => ({}))
vi.mock('@/lib/crm/log-contact', () => ({}))
vi.mock('@/lib/crm/restore', () => ({}))
vi.mock('@/lib/http/safe-fetch', () => ({}))

import { bulkMergeTwoPeople } from '@/app/support/admin/(portal)/crm/actions'

function form(...ids: string[]) {
  const fd = new FormData()
  for (const id of ids) fd.append('selected', id)
  return fd
}

const person = (id: string, activities: number, affiliations: number, createdAt: string) => ({
  id, createdAt: new Date(createdAt), _count: { activities, affiliations },
})

describe('bulkMergeTwoPeople', () => {
  beforeEach(() => {
    findMany.mockReset()
    mergePersonRecords.mockReset()
    mergePersonRecords.mockResolvedValue({ sourceName: 'Source', targetName: 'Target' })
  })

  it('refuses anything but exactly two people, without touching data', async () => {
    for (const fd of [form(), form('a'), form('a', 'b', 'c'), form('a', 'a')]) {
      const r = await bulkMergeTwoPeople(fd)
      expect(r.ok).toBe(false)
    }
    expect(mergePersonRecords).not.toHaveBeenCalled()
  })

  it('stops when one of the two no longer exists', async () => {
    findMany.mockResolvedValue([person('a', 1, 1, '2024-01-01')])
    const r = await bulkMergeTwoPeople(form('a', 'b'))
    expect(r.ok).toBe(false)
    expect(mergePersonRecords).not.toHaveBeenCalled()
  })

  it('keeps the record with more history, whatever the tick order', async () => {
    findMany.mockResolvedValue([person('thin', 0, 1, '2023-01-01'), person('rich', 5, 2, '2024-01-01')])
    const r = await bulkMergeTwoPeople(form('thin', 'rich'))
    expect(r).toEqual({ ok: true, message: 'Merged Source into Target.' })
    expect(mergePersonRecords).toHaveBeenCalledWith('thin', 'rich')
  })

  it('breaks a tie in history by keeping the older record', async () => {
    findMany.mockResolvedValue([person('new', 2, 1, '2025-01-01'), person('old', 2, 1, '2022-01-01')])
    await bulkMergeTwoPeople(form('new', 'old'))
    expect(mergePersonRecords).toHaveBeenCalledWith('new', 'old')
  })
})
