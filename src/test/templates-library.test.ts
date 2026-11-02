import { describe, expect, it } from 'vitest'
import { TEMPLATES, TEMPLATE_LINK_PATHS, TEMPLATE_LINK_SLUGS, fillTemplate, slotsIn, templateBySlug } from '@/lib/templates/library'
import { KEYWORD_CLUSTERS } from '@/lib/seo/keywords'

const norm = (s: string) => s.toLowerCase().replace(/[“”"’']/g, '').replace(/\s+/g, ' ').trim()

describe('template library', () => {
  it('has unique slugs and titles', () => {
    expect(new Set(TEMPLATES.map((t) => t.slug)).size).toBe(TEMPLATES.length)
    expect(new Set(TEMPLATES.map((t) => norm(t.title))).size).toBe(TEMPLATES.length)
  })

  it('has a field for every slot and uses every field', () => {
    for (const t of TEMPLATES) {
      const ids = new Set(t.fields.map((f) => f.id))
      for (const slot of slotsIn(t)) expect(ids.has(slot), `${t.slug}: slot {{${slot}}} has no field`).toBe(true)
      for (const id of ids) expect(slotsIn(t).includes(id), `${t.slug}: field ${id} is never used`).toBe(true)
    }
  })

  it('writes titles and descriptions that fit a search result', () => {
    for (const t of TEMPLATES) {
      expect(t.title.length, t.title).toBeGreaterThanOrEqual(18)
      expect(t.title.length, t.title).toBeLessThanOrEqual(62)
      expect(t.description.length, t.slug).toBeGreaterThanOrEqual(80)
      expect(t.description.length, t.slug).toBeLessThanOrEqual(165)
      expect(t.faq.length, t.slug).toBeGreaterThanOrEqual(2)
      expect(t.tips.length, t.slug).toBeGreaterThanOrEqual(3)
    }
  })

  it('claims no phrase another page owns, and none twice', () => {
    const owned = new Map<string, string>()
    for (const c of KEYWORD_CLUSTERS) for (const p of [c.primary, ...c.secondary]) owned.set(norm(p), c.owner)
    const own = new Map<string, string>()
    const clashes: string[] = []
    for (const t of TEMPLATES) {
      for (const p of [t.primary, ...t.secondary]) {
        const k = norm(p)
        if (owned.has(k)) clashes.push(`"${p}" (${t.slug}) is owned by ${owned.get(k)}`)
        if (own.has(k)) clashes.push(`"${p}" is used by both ${own.get(k)} and ${t.slug}`)
        own.set(k, t.slug)
      }
    }
    expect(clashes).toEqual([])
  })

  it('links related templates that exist', () => {
    for (const t of TEMPLATES) for (const r of t.related) expect(templateBySlug(r), `${t.slug} -> ${r}`).toBeTruthy()
  })

  it('links every template from at least one guide, and only from pages the keyword map owns', () => {
    const owners = new Set(KEYWORD_CLUSTERS.map((c) => c.owner))
    for (const t of TEMPLATES) expect(TEMPLATE_LINK_SLUGS.includes(t.slug), `${t.slug} is linked from no guide`).toBe(true)
    for (const s of TEMPLATE_LINK_SLUGS) expect(templateBySlug(s), `unknown template ${s}`).toBeTruthy()
    for (const p of TEMPLATE_LINK_PATHS) expect(owners.has(p), `${p} is not an owner page`).toBe(true)
  })

  it('shows a visible gap for an empty field and a fallback for an optional one', () => {
    const t = templateBySlug('interview-follow-up-no-response')!
    const empty = fillTemplate(t.body, t.fields, {})
    expect(empty).toContain('[their first name]')
    expect(empty).toContain('The conversation made me more interested')
    expect(fillTemplate(t.body, t.fields, { name: 'Taylor' })).toContain('Hi Taylor,')
  })
})
