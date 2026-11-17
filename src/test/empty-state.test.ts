import { describe, expect, it, vi } from 'vitest'

const redirect = vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`) })
const permanentRedirect = vi.fn((to: string) => { throw new Error(`PERMANENT ${to}`) })
const notFound = vi.fn(() => { throw new Error('NOT_FOUND') })
vi.mock('next/navigation', () => ({ redirect, permanentRedirect, notFound }))

describe('emptyStateOrNotFound', () => {
  it('sends a real state with no data to the section hub', async () => {
    const { emptyStateOrNotFound } = await import('@/lib/seo/empty-state')
    expect(() => emptyStateOrNotFound('georgia', '/layoffs')).toThrow('REDIRECT /layoffs')
    expect(() => emptyStateOrNotFound('new-hampshire', '/places')).toThrow('REDIRECT /places')
  })
  it('redirects permanently when asked', async () => {
    const { emptyStateOrNotFound } = await import('@/lib/seo/empty-state')
    expect(() => emptyStateOrNotFound('new-hampshire', '/layoffs', { permanent: true })).toThrow('PERMANENT /layoffs')
    expect(() => emptyStateOrNotFound('atlantis', '/layoffs', { permanent: true })).toThrow('NOT_FOUND')
  })
  it('still 404s a slug that is not a state', async () => {
    const { emptyStateOrNotFound } = await import('@/lib/seo/empty-state')
    expect(() => emptyStateOrNotFound('atlantis', '/layoffs')).toThrow('NOT_FOUND')
  })
})
