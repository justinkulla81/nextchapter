import { describe, expect, it } from 'vitest'
import { boardBriefHtml, boardBriefPeriod } from '@/lib/workforce/board-brief'
import type { AreaBrief } from '@/lib/workforce/area-brief-data'
import { sanitizeBodyHtml } from '@/lib/mailing/render'

const base: AreaBrief = {
  area: { name: 'Capital Area', state: 'NC', stateName: 'North Carolina', boardId: 'b1' },
  generatedAt: new Date('2026-10-14'),
  candidates: { total: null, byJourney: [], byStage: [], landedRecently: null, windowDays: 90 },
  candidatesScope: 'state',
  boardMembers: null,
  layoffs: { windowDays: 90, totalWorkers: 0, companies: [] },
  hiring: { openRoles: 0, companies: [] },
  news: [],
  funding: [],
}

describe('board brief', () => {
  it('says nothing in a quiet month', () => {
    expect(boardBriefHtml(base, 'October 2026')).toBeNull()
  })
  it('never shows a hidden count', () => {
    const html = boardBriefHtml({ ...base, candidates: { ...base.candidates, total: 40, landedRecently: null, byJourney: [{ key: 'A', label: 'Laid off', count: null }, { key: 'B', label: 'Growing', count: 25 }] } }, 'October 2026')!
    expect(html).toContain('fewer than 10')
    expect(html).not.toContain('Laid off')
    expect(html).toContain('Growing: 25')
  })
  it('escapes text and survives the mailing sanitizer unchanged', () => {
    const html = boardBriefHtml({ ...base, layoffs: { windowDays: 90, totalWorkers: 5, companies: [{ employer: 'A <b>&</b> Co', workers: 5, notices: 1, latestFiled: new Date() }] } }, 'October 2026')!
    expect(html).not.toContain('<b>&</b>')
    expect(sanitizeBodyHtml(html)).toBe(html)
  })
  it('keys the period by month', () => {
    expect(boardBriefPeriod(new Date('2026-10-14T00:00:00Z'))).toEqual({ key: '2026-10', label: 'October 2026' })
  })
})
