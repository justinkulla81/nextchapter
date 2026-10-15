import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
import { slugCandidates } from '@/lib/market/ats-slugs'
import { findAtsBoard } from '@/lib/market/ats-discovery'

describe('slugCandidates', () => {
  it('runs the whole name together, then hyphenates, dropping legal suffixes', () => {
    expect(slugCandidates('Flock Safety')).toEqual(['flocksafety', 'flock-safety'])
    expect(slugCandidates('Netflix, Inc.')).toEqual(['netflix'])
    expect(slugCandidates('Deno Land Inc')).toEqual(['denoland', 'deno-land'])
  })
  it('never offers a first word alone', () => {
    expect(slugCandidates('Flock Freight')).not.toContain('flock')
  })
})

describe('findAtsBoard', () => {
  it('takes a board whose own name matches', async () => {
    const probe = vi.fn(async (p: string, t: string) =>
      p === 'greenhouse' && t === 'flocksafety' ? { jobs: 12, boardName: 'Flock Safety' } : null)
    expect(await findAtsBoard('Flock Safety', probe)).toEqual({ provider: 'greenhouse', token: 'flocksafety' })
  })
  it('rejects a board that belongs to another company', async () => {
    const probe = async (p: string) => (p === 'greenhouse' ? { jobs: 5, boardName: 'Flock Group' } : null)
    expect(await findAtsBoard('Flock Safety', probe)).toBeNull()
  })
  it('ignores an empty board and finds a nameless one on another platform', async () => {
    const probe = async (p: string) => (p === 'lever' ? { jobs: 3, boardName: null } : p === 'greenhouse' ? { jobs: 0, boardName: 'Deno' } : null)
    expect(await findAtsBoard('Deno', probe)).toEqual({ provider: 'lever', token: 'deno' })
  })
})
