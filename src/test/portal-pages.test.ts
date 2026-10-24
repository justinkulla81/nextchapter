import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_TOP_LEVEL } from '@/lib/app-top-level'
import { PORTAL_PAGES } from '@/lib/marketing/portal-pages'
import { plansForPortal } from '@/lib/marketing/plans'
import { HUB_COPY, HUB_PATH, HUB_SEO } from '@/lib/marketing/portal-pages/hub'
import { PORTAL_LIST, PORTALS } from '@/lib/marketing/portals'
import { PORTAL_ORDER } from '@/lib/marketing/plans'
import { hubJsonLd, portalJsonLd, portalMetadata } from '@/lib/marketing/portal-seo'

// Every public partner page is built from one definition (src/lib/marketing/portal-pages). These checks keep each page
// to the owner's brief of 2026-10-24: one headline and one primary action, three screenshots, three steps, plans without
// amounts, a FAQ, unique metadata, a JSON-LD graph with Service, FAQPage and BreadcrumbList, and a sitemap entry.

const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []

const sitemap = readFileSync(join(process.cwd(), 'src/app/sitemap.ts'), 'utf8')

describe('portal pages', () => {
  it('has at least one page and unique paths, titles and descriptions', () => {
    expect(PORTAL_PAGES.length).toBeGreaterThan(0)
    for (const key of ['path', 'title', 'description'] as const) {
      const values = PORTAL_PAGES.map((p) => p.seo[key])
      expect(new Set(values).size, key).toBe(values.length)
    }
  })

  describe.each(PORTAL_PAGES.map((p) => [p.seo.path, p] as const))('%s', (_path, page) => {
    const { seo, content: c } = page
    const copy = strings([seo, c.eyebrow, c.headline, c.subhead, c.primary, c.primaryNote, c.steps, c.claim, c.plansIntro, c.faq, c.finalCta, c.visuals, c.jsonLd, c.proof.kind === 'sample' ? c.proof : null])

    it('has one headline, one primary action, three visuals, three steps and a FAQ', () => {
      expect(c.headline.length).toBeGreaterThan(10)
      expect(c.primary.label).toBeTruthy()
      expect(c.visuals).toHaveLength(3)
      expect(c.steps).toHaveLength(3)
      expect(c.faq.length).toBeGreaterThanOrEqual(3)
      expect(c.path).toBe(seo.path)
    })

    it('shows every plan of the portals it lists, without amounts', () => {
      expect(c.plansFor.length).toBeGreaterThan(0)
      for (const portal of c.plansFor) expect(plansForPortal(portal).length).toBeGreaterThan(0)
    })

    it('makes no unverifiable comparison and shows no amount or cost wording', () => {
      for (const s of copy) {
        expect(s, s).not.toMatch(/\b(only|first|unlike)\b|no other|never been|nobody has|doesn.t exist elsewhere/i)
        expect(s, s).not.toMatch(/\$\s*\d/)
        expect(s, s).not.toMatch(/\b(price|prices|pricing|cost|costs|discount|discounts|savings|per seat|per month)\b/i)
        expect(s, s).not.toMatch(/waitlist|one-click|safe to make/i)
      }
    })

    it('writes links in prose as full URLs', () => {
      for (const s of strings([c.subhead, c.steps, c.claim, c.faq, c.finalCta.intro, c.plansIntro])) {
        expect(s, s).not.toMatch(/(^|\s)\/[a-z][a-z-]*(\/|\s|\.|,|$)/)
      }
    })

    it('has metadata with a canonical path, Open Graph and Twitter', () => {
      const m = portalMetadata(seo)
      expect(m.alternates?.canonical).toBe(seo.path)
      expect(m.openGraph?.title).toBe(seo.title)
      expect(m.twitter).toBeTruthy()
      expect(seo.description.length).toBeGreaterThan(60)
      expect(seo.description.length).toBeLessThanOrEqual(200)
    })

    it('builds Service, FAQPage and BreadcrumbList JSON-LD with plan names only', () => {
      const planNames = c.plansFor.flatMap((p) => plansForPortal(p).map((x) => x.name))
      const graph = portalJsonLd({ ...c.jsonLd, path: c.path, planNames, faq: c.faq }) as { '@graph': { '@type': string }[] }
      expect(graph['@graph'].map((n) => n['@type'])).toEqual(['Service', 'FAQPage', 'BreadcrumbList'])
      const json = JSON.stringify(graph)
      expect(json).not.toMatch(/"price|Offer|\$\s*\d/)
      expect(c.jsonLd.trail.at(-1)?.path).toBe(c.path)
    })

    it('lives in a route folder the proxy knows and is in the sitemap', () => {
      expect(APP_TOP_LEVEL.has(seo.path.split('/')[1])).toBe(true)
      expect(sitemap).toContain(`path: '${seo.path}'`)
    })
  })
})

describe('for-organizations hub', () => {
  const copy = strings([HUB_SEO, HUB_COPY, PORTALS]).filter((s) => !s.startsWith('/'))

  it('has one card per portal, each with a page and a log in, including higher education and workforce', () => {
    expect(PORTAL_LIST.map((p) => p.key)).toEqual(PORTAL_ORDER)
    for (const key of ['higher_education', 'workforce'] as const) expect(PORTALS[key].loginHref).toBeTruthy()
    for (const p of PORTAL_LIST) {
      expect(p.route.startsWith('/')).toBe(true)
      expect(p.loginHref).toBeTruthy()
      expect(PORTAL_PAGES.some((page) => page.seo.path === p.route), p.route).toBe(true)
    }
  })

  it('makes no unverifiable comparison, shows no amount and does not call every portal free', () => {
    for (const s of copy) {
      expect(s, s).not.toMatch(/\b(only|first|unlike)\b|no other/i)
      expect(s, s).not.toMatch(/\$\s*\d/)
      expect(s, s).not.toMatch(/\b(price|prices|pricing|cost|costs|discount|discounts|savings)\b/i)
      expect(s, s).not.toMatch(/free for the people you serve/i)
    }
  })

  it('has metadata, a CollectionPage and BreadcrumbList graph, and a sitemap entry', () => {
    expect(portalMetadata(HUB_SEO).alternates?.canonical).toBe(HUB_PATH)
    const graph = hubJsonLd({ path: HUB_PATH, name: HUB_SEO.title, description: HUB_COPY.jsonLdDescription, items: PORTAL_LIST.map((p) => ({ name: p.name, path: p.route })), trail: HUB_COPY.trail }) as { '@graph': { '@type': string }[] }
    expect(graph['@graph'].map((n) => n['@type'])).toEqual(['CollectionPage', 'BreadcrumbList'])
    expect(sitemap).toContain(`path: '${HUB_PATH}'`)
  })
})
