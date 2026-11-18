import { describe, expect, it } from 'vitest'
import { defaultSharesFor, demoMismatch, decideBlocked, endBlocked, normalizeShares, otherParty, requestBlocked, shareBlocked, sharedWithMe, type Party } from './rules'

const A: Party = { kind: 'INSTITUTION', id: 'one-louisville' }
const B: Party = { kind: 'INSTITUTION', id: 'kentuckiana-works' }
const E: Party = { kind: 'EMPLOYER', id: 'acme' }
const row = (status: string, over = {}) => ({ status, requesterKind: A.kind, requesterId: A.id, targetKind: B.kind, targetId: B.id, requesterShares: ['JOBS', 'EVENTS'], targetShares: ['LAYOFFS'], ...over })

describe('connected portals', () => {
  it('asks once, and points the side that was asked to accept instead of asking back', () => {
    expect(requestBlocked({ me: A, other: B, existing: null })).toBeNull()
    expect(requestBlocked({ me: A, other: A, existing: null })).toMatch(/own organization/)
    expect(requestBlocked({ me: A, other: B, existing: row('REQUESTED') })).toMatch(/waiting/)
    expect(requestBlocked({ me: B, other: A, existing: row('REQUESTED') })).toMatch(/Accept/)
    expect(requestBlocked({ me: A, other: B, existing: row('ACTIVE') })).toMatch(/already connected/)
    expect(requestBlocked({ me: A, other: B, existing: row('ENDED') })).toBeNull()
    expect(requestBlocked({ me: A, other: B, existing: row('DECLINED') })).toBeNull()
  })
  it('lets only the side that was asked answer, once', () => {
    expect(decideBlocked(row('REQUESTED'), B)).toBeNull()
    expect(decideBlocked(row('REQUESTED'), A)).toMatch(/Only the organization/)
    expect(decideBlocked(row('ACTIVE'), B)).toMatch(/already answered/)
    expect(decideBlocked(row('REQUESTED'), E)).toMatch(/Only the organization/)
  })
  it('shares only while connected, and each side sees only what the other chose', () => {
    expect(sharedWithMe(row('ACTIVE'), A)).toEqual(['LAYOFFS'])
    expect(sharedWithMe(row('ACTIVE'), B)).toEqual(['JOBS', 'EVENTS'])
    expect(sharedWithMe(row('REQUESTED'), B)).toEqual([])
    expect(sharedWithMe(row('ENDED'), B)).toEqual([])
    expect(sharedWithMe(row('ACTIVE'), E)).toEqual([])
    expect(shareBlocked(row('REQUESTED'), A)).toMatch(/Connect first/)
    expect(shareBlocked(row('ACTIVE'), E)).toMatch(/not yours/)
  })
  it('lets either side disconnect, and the asker withdraw', () => {
    expect(endBlocked(row('ACTIVE'), A)).toBeNull()
    expect(endBlocked(row('ACTIVE'), B)).toBeNull()
    expect(endBlocked(row('REQUESTED'), A)).toBeNull()
    expect(endBlocked(row('REQUESTED'), B)).toMatch(/nothing to end/)
  })
  it('connects an employer to a workforce organization like any other pair', () => {
    const r = row('ACTIVE', { requesterKind: 'EMPLOYER', requesterId: 'acme' })
    expect(otherParty(r, E)).toEqual(B)
    expect(sharedWithMe(r, E)).toEqual(['LAYOFFS'])
  })
  it('keeps known items once, in order', () => {
    expect(normalizeShares(['EVENTS', 'JOBS', 'EVENTS', 'NAMES'])).toEqual(['JOBS', 'EVENTS'])
    expect(normalizeShares(['EVENTS', 'JOBS', 'LAYOFFS'], 'EMPLOYER')).toEqual(['JOBS'])
  })
  it('starts each side sharing jobs and events, layoffs off; an employer shares jobs', () => {
    expect(defaultSharesFor('INSTITUTION')).toEqual(['JOBS', 'EVENTS'])
    expect(defaultSharesFor('EMPLOYER')).toEqual(['JOBS'])
  })
  it('keeps demos with demos', () => {
    expect(demoMismatch({ demo: true }, { demo: false })).toBe(true)
    expect(demoMismatch({ demo: true }, { demo: true })).toBe(false)
  })
})
