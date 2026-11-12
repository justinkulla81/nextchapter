import { describe, expect, it } from 'vitest'
import { isScannerClickVisit, scannerClickVisitSql, type MailClick } from '@/lib/marketing/scanner-click-visit'

const PAGE = '/reports/white-collar-employment-report-october-2026'
const LINK = `https://launchyournextchapter.com${PAGE}?nc_m=abc`
const at = (s: string) => new Date(`2026-11-12T08:${s}Z`)
const visit = (s: string, ip = '206.204.17.158', path: string | null = PAGE) => ({ at: at(s), ip, path, eventType: 'PAGE_VIEW' })
const click = (s: string, bot: boolean, ip: string | null = '10.0.0.1', link = LINK): MailClick => ({ at: at(s), ip, link, bot })

describe('isScannerClickVisit', () => {
  it('flags the page view that follows a bot-flagged click on that page (Beth Moe)', () => {
    expect(isScannerClickVisit(visit('13:21'), [click('13:12', true), click('13:30', true)])).toBe(true)
  })
  it('keeps a visit with no click near it', () => {
    expect(isScannerClickVisit(visit('13:21'), [click('10:00', true)])).toBe(false)
  })
  it('keeps a visit when a human clicked the same page in the window', () => {
    expect(isScannerClickVisit(visit('13:21'), [click('13:20', true), click('13:25', false)])).toBe(false)
  })
  it('keeps a visit from an address that made a human click in the days around it', () => {
    const clicks = [click('13:20', true), click('00:30', false, '103.196.9.225')]
    expect(isScannerClickVisit(visit('13:21', '103.196.9.225'), clicks)).toBe(false)
    expect(isScannerClickVisit(visit('13:21', '103.196.9.226'), clicks)).toBe(true)
  })
  it('ignores a bot click on a different page, a click-event row, and the bare homepage', () => {
    expect(isScannerClickVisit(visit('13:21'), [click('13:20', true, '1.1.1.1', 'https://launchyournextchapter.com/jobs')])).toBe(false)
    expect(isScannerClickVisit({ ...visit('13:21'), eventType: 'LINK_CLICK' }, [click('13:20', true)])).toBe(false)
    expect(isScannerClickVisit(visit('13:21', '1.1.1.1', '/'), [click('13:20', true)])).toBe(false)
  })
  it('matches the page by its path with the query string removed', () => {
    expect(isScannerClickVisit(visit('13:21', '1.1.1.1', `${PAGE}?nc_m=zzz&utm_source=x`), [click('13:20', true)])).toBe(true)
  })
})

describe('scannerClickVisitSql', () => {
  it('carries the same windows as the code rule', () => {
    expect(scannerClickVisitSql).toContain('make_interval(secs => 30)')
    expect(scannerClickVisitSql).toContain('make_interval(hours => 24)')
    expect(scannerClickVisitSql).toContain('h."ip" = "HomepageVisitEvent"."ip"')
  })
})
