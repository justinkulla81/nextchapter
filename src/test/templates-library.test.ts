import { describe, expect, it } from 'vitest'
import { TEMPLATES, fillTemplate, slotsIn, templateBySlug } from '@/lib/templates/library'
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
    for (const t of TEMPLATES) {
      for (const p of [t.primary, ...t.secondary]) {
        const k = norm(p)
        expect(owned.has(k), `"${p}" (${t.slug}) is owned by ${owned.get(k)}`).toBe(false)
        expect(own.has(k), `"${p}" is used by both ${own.get(k)} and ${t.slug}`).toBe(false)
        own.set(k, t.slug)
      }
    }
  })

  it('links related templates that exist', () => {
    for (const t of TEMPLATES) for (const r of t.related) expect(templateBySlug(r), `${t.slug} -> ${r}`).toBeTruthy()
  })

  it('shows a visible gap for an empty field and a fallback for an optional one', () => {
    const t = templateBySlug('interview-follow-up-no-response')!
    const empty = fillTemplate(t.body, t.fields, {})
    expect(empty).toContain('[their first name]')
    expect(empty).toContain('The conversation made me more interested')
    expect(fillTemplate(t.body, t.fields, { name: 'Taylor' })).toContain('Hi Taylor,')
  })
})
