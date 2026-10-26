import { describe, expect, it } from 'vitest'
import employers from '@/lib/events/conference-employers.json'
import catalog from '@/lib/events/catalog.json'

const ids = new Set((catalog as { rows: { id: string }[] }).rows.map((r) => r.id))

describe('conference employer data', () => {
  const data = employers as Record<string, { name: string; role: string; year: number | null; sourceUrl: string | null }[]>
  it('only names conferences in the catalog', () => {
    for (const id of Object.keys(data)) expect(ids.has(id), id).toBe(true)
  })
  it('keeps every row sourced, typed and plain', () => {
    for (const [id, rows] of Object.entries(data)) {
      const seen = new Set<string>()
      for (const r of rows) {
        expect(['SPONSOR', 'EXHIBITOR', 'SPEAKER', 'ATTENDEE']).toContain(r.role)
        expect(r.sourceUrl, `${id} ${r.name}`).toMatch(/^https:\/\//)
        expect(r.name.length).toBeGreaterThan(1)
        const key = `${r.name.toLowerCase()}:${r.role}`
        expect(seen.has(key), `${id} duplicate ${key}`).toBe(false)
        seen.add(key)
      }
    }
  })
})
