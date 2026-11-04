import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { landingHeadline, landingVariant, layoffFactLine, pickPagePhoto, PAGE_PHOTOS, Q1, reportLine } from '@/lib/layoffs/landing'
import { PERSONAS } from '@/lib/constants/personas'

describe('company page landing helpers', () => {
  it('picks the page version: a recent buyout wins, then any layoff, otherwise neither', () => {
    expect(landingVariant({ hasRecentBuyout: true, hasNoticesOrLayoffReport: true })).toBe('buyout')
    expect(landingVariant({ hasRecentBuyout: false, hasNoticesOrLayoffReport: true })).toBe('layoff')
    expect(landingVariant({ hasRecentBuyout: false, hasNoticesOrLayoffReport: false })).toBe('neither')
  })

  it('writes plain headlines and only says "filed" when a WARN notice exists', () => {
    expect(landingHeadline('buyout', 'Microsoft', null)).toBe('Microsoft is offering buyouts. Here is how to decide, and what to do either way.')
    expect(landingHeadline('layoff', 'Microsoft', 277)).toBe('Microsoft filed layoffs for 277 workers. Here is what to do this week.')
    expect(landingHeadline('layoff', 'Microsoft', null, false)).toBe('Microsoft layoffs have been reported. Here is what to do this week.')
    expect(landingHeadline('layoff', 'TIAA', 20, true, 3)).toBe("TIAA's latest layoff notice names 20 workers. Here is what to do this week.")
    expect(landingHeadline('layoff', 'TIAA', 20, true, 1)).toBe('TIAA filed layoffs for 20 workers. Here is what to do this week.')
    expect(landingHeadline('layoff', 'Squarespace', 1000, false)).toBe('Squarespace is laying off about 1,000 people. Here is what to do this week.')
    expect(landingHeadline('neither', 'Costco', null)).toBe('Thinking about your next move from Costco? Start by seeing what is out there.')
  })

  it('keeps the same photo for a company every time, and varies across companies and people', () => {
    expect(pickPagePhoto('microsoft')).toBe(pickPagePhoto('microsoft'))
    const slugs = ['microsoft', 'amazon', 'intel', 'salesforce', 'boeing', 'tiktok', 'meta', 'oracle', 'ibm', 'cisco', 'nike', 'visa', 'dell', 'hp', 'ups']
    const picks = slugs.map((s) => pickPagePhoto(s))
    expect(new Set(picks.map((p) => p.src)).size).toBeGreaterThan(5)
    expect(new Set(picks.map((p) => p.who))).toEqual(new Set(['vic', 'chris', 'sarah']))
  })

  it('lists only pictures that exist, with descriptive alt text and no names for the story personas', () => {
    for (const p of PAGE_PHOTOS) {
      expect(existsSync(join(process.cwd(), 'public', p.src))).toBe(true)
      expect(p.alt.length).toBeGreaterThan(20)
      if (p.who !== 'vic') expect(p.alt).not.toMatch(/chris|sarah/i)
    }
    expect(PAGE_PHOTOS.map((p) => p.src)).not.toContain('/marketing/chris-home-office.webp')
  })

  it('maps every answer to a real journey', () => {
    const slugs = new Set(PERSONAS.map((p) => p.slug))
    for (const answers of Object.values(Q1)) for (const a of answers) expect(slugs.has(a.persona)).toBe(true)
  })

  it('words the facts the way people say them: layoffs and the number, never WARN', () => {
    expect(reportLine('Nov 1, 2026', 'Reported by 3 publishers · 19% of staff')).toBe('Reported Nov 1, 2026: 19% of staff, according to 3 news outlets.')
    expect(reportLine('Nov 1, 2026', 'Reported by 1 publisher')).toBe('Reported Nov 1, 2026, according to a news outlet.')
    expect(reportLine('Oct 26, 2026', 'Voluntary buyout offered to about 60,000 employees')).toBe('Reported Oct 26, 2026: Voluntary buyout offered to about 60,000 employees.')
    const line = layoffFactLine({ name: 'Microsoft', filings: 7, workers: 4084, exact: true, places: 'Washington', latest: 'Sep 22, 2026' })
    expect(line).toBe('Microsoft has reported 7 layoffs in Washington, 4,084 people in all. The latest was Sep 22, 2026.')
    expect(line).not.toMatch(/warn/i)
    expect(layoffFactLine({ name: 'TIAA', filings: 1, workers: 20, exact: false, places: '', latest: 'Oct 1, 2026' })).toBe('TIAA has reported a layoff, at least 20 people in all. The latest was Oct 1, 2026.')
  })
})
