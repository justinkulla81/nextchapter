import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { snapshotVersion } from '@/lib/jobs/board-shortlist'

describe('snapshotVersion', () => {
  it('stamps the version when the board held still across the read', () => {
    expect(snapshotVersion('1:10:20:0', '1:10:20:0')).toBe('1:10:20:0')
  })

  it('still writes a board that changed while it was read, under a mark no version equals', () => {
    const v = snapshotVersion('1:10:20:0', '1:10:25:0')
    expect(v).not.toBeNull()
    expect(v).not.toBe('1:10:20:0')
    expect(v).not.toBe('1:10:25:0')
  })

  it('writes nothing when the version is unreadable', () => {
    expect(snapshotVersion(null, null)).toBeNull()
  })
})
