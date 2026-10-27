import { describe, expect, it } from 'vitest'
import { buildSectionsForArea, type AdminArea } from '@/components/admin/AdminNav'

const AREAS: AdminArea[] = ['administrator', 'ecosystem', 'vision']

describe('admin menu', () => {
  for (const area of AREAS) {
    it(`${area}: every page appears once and every label is unique`, () => {
      const links = buildSectionsForArea(area, {}).flatMap((s) => s.links)
      const hrefs = links.map((l) => l.href)
      expect(new Set(hrefs).size).toBe(hrefs.length)
      const labels = links.map((l) => l.label)
      expect(new Set(labels).size).toBe(labels.length)
    })
  }

  it('Weekly recognition archive lives under Reports', () => {
    const reports = buildSectionsForArea('administrator', {}).find((s) => s.title === 'Reports')
    expect(reports?.links.map((l) => l.href)).toContain('/support/admin/weekly-recognition')
  })

  it('Operations lists its unbuilt areas in one Planned section', () => {
    const titles = buildSectionsForArea('vision', {}).map((s) => s.title)
    expect(titles).toEqual(['Product', 'Planned'])
  })
})

describe('mailing menu', () => {
  it('has one Mailing lists entry; its sub-pages are reached from that page', () => {
    const email = buildSectionsForArea('ecosystem', {}).find((s) => s.title === 'Email')
    const hrefs = email?.links.map((l) => l.href) ?? []
    expect(hrefs).toContain('/support/admin/crm/mailing')
    expect(hrefs).not.toContain('/support/admin/crm/mailing/lists')
    expect(hrefs).not.toContain('/support/admin/crm/mailing/unsubscribes')
  })
})
