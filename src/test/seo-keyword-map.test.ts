import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { GUIDE_LANDING_CONTENT } from '@/lib/constants/guide-landing-content'
import { PERSONAS } from '@/lib/constants/personas'
import { KEYWORD_CLUSTERS, NO_TARGET_PAGES, ANCHORS, RELATED } from '@/lib/seo/keywords'
import { keywordMapMarkdown } from '@/lib/seo/keyword-map-md'
import { TOPICS } from '@/lib/seo/explainers'

const root = process.cwd()
const norm = (s: string) => s.toLowerCase().replace(/[“”"’']/g, '').replace(/\s+/g, ' ').trim()
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'at', 'with', 'my', 'your', 'you', 'is', 'how', 'what', 'by', 'vs', 'me', 'i'])
const tokens = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t)).map((t) => t.replace(/(ing|ed|es|s|e)$/, ''))

describe('keyword map', () => {
  it('gives every phrase one owner', () => {
    const seen = new Map<string, string>()
    const clashes: string[] = []
    for (const c of KEYWORD_CLUSTERS) {
      for (const phrase of [c.primary, ...c.secondary]) {
        const key = norm(phrase)
        const prev = seen.get(key)
        if (prev && prev !== c.owner) clashes.push(`"${phrase}" is owned by both ${prev} and ${c.owner}`)
        seen.set(key, c.owner)
      }
    }
    expect(clashes).toEqual([])
  })

  it('has one cluster per owner and unique titles', () => {
    const owners = KEYWORD_CLUSTERS.map((c) => c.owner)
    expect(new Set(owners).size).toBe(owners.length)
    const titles = KEYWORD_CLUSTERS.flatMap((c) => (c.seo ? [norm(c.seo.title)] : []))
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('points every single-page owner at a page that exists', () => {
    const personas = new Set(PERSONAS.map((p) => p.slug))
    const guides = new Set(GUIDE_LANDING_CONTENT.map((g) => g.slug))
    const topics = new Set(TOPICS.map((t) => t.slug))
    for (const c of KEYWORD_CLUSTERS.filter((k) => k.kind === 'page')) {
      const [, first, second] = c.owner.split('/')
      const exists =
        c.owner === '/' ||
        existsSync(join(root, 'src/app', c.owner, 'page.tsx')) ||
        (first === 'start' && personas.has(second)) ||
        (first === 'resources' && guides.has(second)) ||
        (first === 'topics' && topics.has(second))
      expect(exists, `${c.owner} has no page`).toBe(true)
    }
  })

  it('writes a title, description and primary phrase that fit a search result', () => {
    for (const c of KEYWORD_CLUSTERS) {
      if (!c.seo) continue
      const { title, description, h1 } = c.seo
      expect(title.length, `${c.owner} title: ${title}`).toBeGreaterThanOrEqual(18)
      expect(title.length, `${c.owner} title: ${title}`).toBeLessThanOrEqual(62)
      expect(description.length, `${c.owner} description`).toBeGreaterThanOrEqual(80)
      expect(description.length, `${c.owner} description`).toBeLessThanOrEqual(165)
      const have = new Set(tokens(`${title} ${h1 ?? ''} ${description}`))
      const want = tokens(c.primary)
      const hit = want.filter((t) => have.has(t)).length
      expect(hit / want.length, `${c.owner}: primary phrase "${c.primary}" is not in the title, headline or description`).toBeGreaterThanOrEqual(0.6)
    }
  })

  it('keeps the positioning line to the pages that introduce NextChapter', () => {
    const allowed = new Set(['/', '/how-it-works'])
    for (const c of KEYWORD_CLUSTERS) {
      if (c.seo && /leading job transition platform/i.test(c.seo.description)) expect(allowed.has(c.owner), `${c.owner} repeats the positioning line`).toBe(true)
    }
  })

  it('covers every page in the sitemap', () => {
    const src = readFileSync(join(root, 'src/app/sitemap.ts'), 'utf8')
    const paths = [...src.matchAll(/path: '(\/[^']*)'/g)].map((m) => m[1])
    const owned = new Set(KEYWORD_CLUSTERS.map((c) => c.owner))
    const exempt = new Set<string>([...NO_TARGET_PAGES, '/authors/:slug'])
    const missing = paths.filter((p) => !owned.has(p) && !exempt.has(p))
    expect(missing).toEqual([])
  })

  it('links only to pages the map knows', () => {
    const owners = new Set(KEYWORD_CLUSTERS.map((c) => c.owner))
    for (const [from, tos] of Object.entries(RELATED)) {
      expect(owners.has(from), `${from} is not an owner`).toBe(true)
      for (const to of tos) expect(owners.has(to), `${from} links to unknown ${to}`).toBe(true)
    }
    for (const a of Object.keys(ANCHORS)) expect(owners.has(a), `anchor for unknown ${a}`).toBe(true)
  })

  it('keeps docs/seo/keyword-map.md in sync', () => {
    const file = readFileSync(join(root, 'docs/seo/keyword-map.md'), 'utf8')
    expect(file.trim(), 'run `npm run seo:keyword-map`').toBe(keywordMapMarkdown().trim())
  })
})
