import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { PortalMarketingPage } from '@/components/marketing/PortalMarketingPage'
import { PORTAL_PAGES } from '@/lib/marketing/portal-pages'

describe('portal pages render', () => {
  it('renders every page', () => {
    for (const p of PORTAL_PAGES) {
      const html = renderToStaticMarkup(<PortalMarketingPage content={p.content} />)
      expect(html).toContain(p.content.headline)
      expect((html.match(/<img/g) ?? []).length, p.seo.path).toBeGreaterThanOrEqual(3)
      expect(html).toContain('id="plans"')
      expect(html).toContain('application/ld+json')
      if (p.content.claim) expect(html).toContain('id="claim"')
      expect(html).toContain('id="talk"')
    }
  })
})
