import { describe, expect, it } from 'vitest'
// @ts-expect-error Next ships path-to-regexp compiled, without types
import { pathToRegexp } from 'next/dist/compiled/path-to-regexp'
import nextConfig from '../../next.config'

// The redirect that sends stale dotted outside-link addresses under org pages to the state index must not catch the
// sitemap files (/job-centers/sitemap/0.xml): it did on 2026-10-27 and both sitemaps answered 307 then 404.
describe('org page dotted-address redirect', () => {
  it('leaves the sitemap files alone but still catches a dotted outside link', async () => {
    const rules = (await nextConfig.redirects!()).filter((r) => r.source.includes(':host'))
    expect(rules.length).toBe(3)
    for (const r of rules) {
      const re = pathToRegexp(r.source)
      const kind = r.source.split('/')[1]
      expect(re.test(`/${kind}/sitemap/0.xml`)).toBe(false)
      expect(re.test(`/${kind}/utah/garfield.utah.gov/page`)).toBe(true)
      expect(re.test(`/${kind}/kentucky/some-real-slug`)).toBe(false)
    }
  })
})
