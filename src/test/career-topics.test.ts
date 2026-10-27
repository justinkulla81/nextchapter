import { describe, expect, it } from 'vitest'
import { TOPICS } from '@/lib/seo/explainers'

// The career topics are written to be read, not templated: each must carry real substance and must not share long runs of text
// with another topic (docs/seo/README.md: a page below the quality bar stays out of the sitemap).
const NEW = ['what-to-say-when-laid-off', 'acquisition-layoffs', 'should-i-take-the-buyout', 'fired-vs-laid-off']
const body = (t: (typeof TOPICS)[number]) => [t.lede, ...t.sections.flatMap((s) => [...(s.paragraphs ?? []), ...(s.bullets ?? [])]), ...t.faq.map((f) => f.a)].join(' ')
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean)
const shingles = (s: string, n = 8) => { const w = words(s); const out = new Set<string>(); for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' ')); return out }

describe('new career topics', () => {
  for (const slug of NEW) {
    const t = TOPICS.find((x) => x.slug === slug)
    it(`${slug} exists with enough substance`, () => {
      expect(t).toBeTruthy()
      expect(words(body(t!)).length).toBeGreaterThanOrEqual(450)
      expect(t!.sections.length).toBeGreaterThanOrEqual(5)
      expect(t!.faq.length).toBeGreaterThanOrEqual(4)
    })
  }
  it('no two topics share an 8-word run', () => {
    const slugs = NEW
    for (const a of slugs) for (const b of TOPICS.map((t) => t.slug)) {
      if (a >= b && slugs.includes(b)) continue
      if (a === b) continue
      const sa = shingles(body(TOPICS.find((t) => t.slug === a)!)); const sb = shingles(body(TOPICS.find((t) => t.slug === b)!))
      const shared = [...sa].filter((x) => sb.has(x))
      expect(shared, `${a} and ${b} share: ${shared.slice(0, 2).join(' | ')}`).toEqual([])
    }
  })
})
