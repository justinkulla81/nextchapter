import { describe, expect, it, vi } from 'vitest'

const permanentRedirect = vi.fn((to: string) => { throw new Error(`PERMANENT ${to}`) })
const notFound = vi.fn(() => { throw new Error('NOT_FOUND') })
vi.mock('next/navigation', () => ({ permanentRedirect, notFound }))

describe('emptyStateOrNotFound', () => {
  it('sends a real state with no data to the section hub, permanently', async () => {
    const { emptyStateOrNotFound } = await import('@/lib/seo/empty-state')
    expect(() => emptyStateOrNotFound('georgia', '/layoffs')).toThrow('PERMANENT /layoffs')
    expect(() => emptyStateOrNotFound('new-hampshire', '/places')).toThrow('PERMANENT /places')
  })
  it('still 404s a slug that is not a state', async () => {
    const { emptyStateOrNotFound } = await import('@/lib/seo/empty-state')
    expect(() => emptyStateOrNotFound('atlantis', '/layoffs')).toThrow('NOT_FOUND')
  })
})
