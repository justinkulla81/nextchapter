import { describe, expect, it } from 'vitest'
import { directoryLetter, layoffDirectory } from '@/lib/warn/layoff-directory'
import type { CompanySummary, PublicNotice } from '@/lib/warn/layoff-pages'
import type { CompanyAnnouncements } from '@/lib/warn/company-announcements'

const NOW = Date.parse('2026-11-13T00:00:00Z')
const day = (iso: string) => new Date(`${iso}T00:00:00Z`)
const notice = (workers: number | null) => ({ workers }) as PublicNotice
const company = (slug: string, name: string, latest: string, workers: (number | null)[], states = ['CA']): CompanySummary => ({
  slug, name, latest: day(latest), states, notices: workers.map(notice),
})

describe('layoffDirectory', () => {
  it('lists every employer with a filing in the last 12 months, A to Z, and leaves older ones out', () => {
    const companies = new Map([
      ['marriott', company('marriott', 'Marriott', '2026-10-28', [91])],
      ['angi', company('angi', 'Angi', '2026-11-03', [200, 100])],
      ['old-co', company('old-co', 'Old Co', '2025-06-01', [10])],
    ])
    const out = layoffDirectory(companies, new Map(), NOW)
    expect(out.map((e) => e.slug)).toEqual(['angi', 'marriott'])
    expect(out[0].workers).toBe(300)
  })

  it('adds a recent announcement with no filing, once', () => {
    const companies = new Map([['nice', company('nice', 'NICE', '2026-11-03', [null])]])
    const ann = (slug: string, name: string, latest: string): CompanyAnnouncements => ({ slug, name, latest: day(latest), items: [] })
    const announcements = new Map([
      ['nice', ann('nice', 'NICE', '2026-11-03')],
      ['zeta', ann('zeta', 'Zeta', '2026-11-10')],
    ])
    const out = layoffDirectory(companies, announcements, NOW)
    expect(out.map((e) => e.slug)).toEqual(['nice', 'zeta'])
    expect(out[0].workers).toBeNull()
  })
})

describe('directoryLetter', () => {
  it('files names by first letter, digits under #', () => {
    expect(directoryLetter('angi')).toBe('A')
    expect(directoryLetter('3M')).toBe('#')
  })
})
