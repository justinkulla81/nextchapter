import { describe, expect, it } from 'vitest'

// Addresses crawlers and new visitors guess on any company site must land on a real page, not a 404.
const GUESSED = ['/about-us', '/team', '/contact-us', '/partners', '/sponsorship', '/speakers', '/call-for-speakers', '/cfp', '/organizers', '/organisers', '/login', '/signup', '/privacy', '/terms-of-service', '/help', '/support', '/blog', '/sitemap', '/noexperience/employers']

describe('guessed addresses', () => {
  it('each redirects', async () => {
    const config = (await import('../../next.config')).default
    const sources = new Set(((await config.redirects?.()) ?? []).map((r) => r.source))
    expect(GUESSED.filter((u) => !sources.has(u))).toEqual([])
  })
})
