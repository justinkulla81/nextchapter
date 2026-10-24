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
