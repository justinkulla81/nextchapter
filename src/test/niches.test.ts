import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NICHES } from '@/lib/niches/niches'
import { TOPICS } from '@/lib/seo/explainers'
import { KEYWORD_CLUSTERS } from '@/lib/seo/keywords'

const root = process.cwd()
const owners = new Set(KEYWORD_CLUSTERS.map((c) => c.owner))
const topicSlugs = new Set(TOPICS.map((t) => t.slug))

describe('niches', () => {
  it('have unique slugs and each is a keyword-map owner', () => {
    expect(new Set(NICHES.map((n) => n.slug)).size).toBe(NICHES.length)
    for (const n of NICHES) expect(owners.has(`/niches/${n.slug}`), n.slug).toBe(true)
  })

  it('pick companies by category or by name', () => {
    for (const n of NICHES) expect(n.categories.length + (n.includeNames?.length ?? 0), n.slug).toBeGreaterThan(0)
  })

  it('link only to pages that exist', () => {
    const missing: string[] = []
    for (const n of NICHES) {
      for (const r of n.related) {
        const [, a, b] = r.href.split('/')
        const ok = existsSync(join(root, 'src/app', r.href, 'page.tsx')) || (a === 'topics' && topicSlugs.has(b)) || (a === 'niches' && NICHES.some((x) => x.slug === b)) || (a === 'resources' || a === 'start' || a === 'jobs')
        if (!ok) missing.push(`${n.slug} -> ${r.href}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('make no claims about named companies or superlatives in their copy', () => {
    const SUPER = /\b(only|first|best|leading|fastest|cheapest|number one|guaranteed)\b/i
    for (const n of NICHES) {
      const text = [n.what, n.whoFor, ...n.howToChoose].join(' ')
      expect(text.match(SUPER)?.[0], n.slug).toBeUndefined()
    }
  })
})
