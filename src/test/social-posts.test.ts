import { describe, expect, it } from 'vitest'
import { linkFacets, oauth1Header } from '@/lib/social/clients'
import { splitFilingEmployer, isClosure, announcementBasis, announcementPostText, filingPostText, jobsReportPost, joltsPost, MIN_DAILY_NOTICES, MIN_NOTICES, MIN_RANKINGS_POSTED, dailyLayoffPost, rankingsPost, reportPost, weekKey, weeklyLayoffPost, type DayNotice, type WeekNotice } from '@/lib/social/posts'

const now = new Date('2026-10-26T13:00:00Z')
const day = 86_400_000
const notice = (daysAgo: number, state = 'CA', workers: number | null = 100): WeekNotice => ({ state, workers, noticeDate: new Date(now.getTime() - daysAgo * day) })

describe('weeklyLayoffPost', () => {
  it('skips a quiet week', () => {
    expect(weeklyLayoffPost(Array.from({ length: MIN_NOTICES - 1 }, () => notice(1)), now, 'u=1')).toBeNull()
  })

  it('totals the last seven days, compares with the week before, names no employer', () => {
    const rows = [...Array.from({ length: 12 }, () => notice(2, 'TX', 50)), ...Array.from({ length: 4 }, () => notice(3, 'CA', 200)), ...Array.from({ length: 5 }, () => notice(10))]
    const post = weeklyLayoffPost(rows, now, 'utm_source=x')!
    expect(post.key).toBe('layoffs-week-2026-W44')
    expect(post.text).toContain('16 WARN notices naming 1,400 workers')
    expect(post.text).toContain('11 more than the week before')
    expect(post.text).toContain('Most workers: California, Texas')
    expect(post.text).toContain('https://launchyournextchapter.com/layoffs/this-week?utm_source=x')
    expect(post.text.length).toBeLessThanOrEqual(280)
  })

  it('ignores notices older than seven days and future-dated ones', () => {
    const rows = [...Array.from({ length: 10 }, () => notice(1)), notice(8), notice(-2)]
    expect(weeklyLayoffPost(rows, now, 'u=1')!.text).toContain('10 WARN notices')
  })
})

describe('weekKey', () => {
  it('uses ISO weeks across a year boundary', () => {
    expect(weekKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-W01')
    expect(weekKey(new Date('2027-01-01T00:00:00Z'))).toBe('2026-W53')
  })
})

describe('linkFacets', () => {
  it('uses UTF-8 byte offsets, so text before the link can hold multi-byte characters', () => {
    const text = 'Naïve café → https://example.com/a?b=1'
    const [f] = linkFacets(text)
    const bytes = Buffer.from(text)
    expect(bytes.subarray(f.index.byteStart, f.index.byteEnd).toString()).toBe('https://example.com/a?b=1')
  })
  it('returns nothing when there is no link', () => expect(linkFacets('no link')).toEqual([]))
})

describe('oauth1Header', () => {
  it('signs the way the OAuth 1.0a spec example does', () => {
    // Fixed nonce/timestamp make the signature reproducible.
    const h = oauth1Header('POST', 'https://api.x.com/2/tweets', { key: 'ck', secret: 'cs', token: 'at', tokenSecret: 'ts' }, 'abc123', '1700000000')
    expect(h).toMatch(/^OAuth oauth_consumer_key="ck", oauth_nonce="abc123", oauth_signature="[^"]+", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1700000000", oauth_token="at", oauth_version="1.0"$/)
    expect(h).toBe(oauth1Header('POST', 'https://api.x.com/2/tweets', { key: 'ck', secret: 'cs', token: 'at', tokenSecret: 'ts' }, 'abc123', '1700000000'))
  })
})

describe('filingPostText', () => {
  it('is under 280 characters with the link counted as 23, and names only what the filing says', async () => {
    const { filingPostText } = await import('@/lib/social/posts')
    const t = filingPostText({ employer: 'Acme Widgets Incorporated of North America and Affiliated Companies Holdings', state: 'WA', workers: 1985, date: new Date('2026-05-13T12:00:00Z'), path: '/layoffs/company/acme' }, 'utm_source=x')
    const link = t.match(/https:\/\/\S+/)![0]
    expect(t.length - link.length + 23).toBeLessThanOrEqual(280)
    expect(t).toContain('WARN layoff notice in Washington on May 13, naming 1,985 workers')
    expect(t).toContain('/layoffs/company/acme?utm_source=x')
  })
})

describe('channel registry', () => {
  it('puts X in the automatic filing stream, under its own cap (billed per post)', async () => {
    const { CHANNELS } = await import('@/lib/social/channels')
    expect(CHANNELS.find((c) => c.id === 'x')!.autoFilings).toBe(true)
    expect(CHANNELS.filter((c) => c.autoFilings).map((c) => c.id).sort()).toEqual(['bluesky', 'discord', 'facebook', 'mastodon', 'slack', 'telegram', 'threads', 'x'])
  })
})

describe('dailyLayoffPost', () => {
  const hour = 3_600_000
  const fresh = (hoursAgo: number, state = 'CA', workers: number | null = 100): DayNotice => ({ state, workers, fetchedAt: new Date(now.getTime() - hoursAgo * hour) })

  it('skips a quiet day', () => {
    expect(dailyLayoffPost(Array.from({ length: MIN_DAILY_NOTICES - 1 }, () => fresh(1)), now, 'u=1')).toBeNull()
  })

  it('totals what we collected in the last 24 hours, names no employer, and keys the day', () => {
    const rows = [fresh(2, 'TX', 50), fresh(3, 'TX', 70), fresh(5, 'CA', 200), fresh(30, 'NY', 999)]
    const post = dailyLayoffPost(rows, now, 'utm_source=bluesky')!
    expect(post.key).toBe('layoffs-day-2026-10-26')
    expect(post.text).toContain('3 WARN notices in 2 states, naming 320 workers')
    expect(post.text).toContain('Most workers: California, Texas')
    expect(post.text).not.toContain('New York')
    expect(post.text).toContain('/layoffs/this-week?utm_source=bluesky')
    expect(post.text.length).toBeLessThanOrEqual(280)
  })
})

describe('reportPost', () => {
  const edition = { slug: 'white-collar-employment-report-september-2026', month: 'September 2026', title: 'Jobs are growing, and some searches are taking longer', publishedAt: '2026-10-22' }

  it('announces a recent edition once, under 280 characters with the link counted as 23', () => {
    const post = reportPost(edition, now, 'utm_source=x')!
    expect(post.key).toBe('report-white-collar-employment-report-september-2026')
    expect(post.text).toContain('September 2026')
    expect(post.text).toContain('/reports/white-collar-employment-report-september-2026?utm_source=x')
    const link = post.text.slice(post.text.indexOf('https://'))
    expect(post.text.length - link.length + 23).toBeLessThanOrEqual(280)
  })

  it('never announces an old edition, a future one, or none', () => {
    expect(reportPost({ ...edition, publishedAt: '2026-09-01' }, now, 'u=1')).toBeNull()
    expect(reportPost({ ...edition, publishedAt: '2026-11-30' }, now, 'u=1')).toBeNull()
    expect(reportPost(null, now, 'u=1')).toBeNull()
  })
})

describe('X filing rules', () => {
  it('limits X to the biggest layoffs and three a day', async () => {
    const { FILING_RULES } = await import('@/lib/social/filings')
    expect(FILING_RULES.x).toEqual({ minWorkers: 250, perDay: 3 })
  })
})

describe('rankingsPost', () => {
  const nov = new Date('2026-11-04T13:00:00Z')
  const list = (slug: string, measure: string, extra: Record<string, unknown> = {}) => ({ slug, measure, scopeKind: 'national', title: slug, edition: '2026-11', topName: 'Austin', topValueLabel: '12.0%', editions: ['2026-11'], ...extra })
  const many = Array.from({ length: MIN_RANKINGS_POSTED }, (_, i) => list(`l${i}`, 'x', { scopeKind: 'region' }))

  it('waits for the month to have enough lists', () => {
    expect(rankingsPost([list('a', 'junior')], nov, 'u=1')).toBeNull()
  })
  it('never runs past 300 characters with the link, dropping list lines first', () => {
    const long = 'A Very Long Metropolitan Place Name, Somewhere'
    const post = rankingsPost([...many, list('a', 'junior', { topName: long }), list('b', 'ai', { topName: long }), list('c', 'paycost', { topName: long })], nov, 'utm_source=bluesky&utm_medium=social&utm_campaign=data-story')!
    expect([...post.text].length).toBeLessThanOrEqual(300)
    expect(post.text).toContain('/rankings/archive/2026-11')
  })
  it('announces the month once, with the leaders of three national lists and the archive link', () => {
    const post = rankingsPost([...many, list('best-cities-for-junior-jobs', 'junior'), list('x-ai', 'ai', { topName: 'Seattle' }), list('x-pay', 'paycost', { topName: 'Dallas' })], nov, 'utm_source=x')!
    expect(post.key).toBe('rankings-2026-11')
    expect(post.text).toContain('November 2026: 53 lists')
    expect(post.text).toContain('#1 for Entry-level jobs: Austin (12.0%)')
    expect(post.text).toContain('#1 for AI skills asked for: Seattle')
    expect(post.text).toContain('https://launchyournextchapter.com/rankings/archive/2026-11?utm_source=x')
    expect(post.text.length).toBeLessThanOrEqual(280)
  })
  it('never announces an older month', () => {
    expect(rankingsPost(many, new Date('2026-12-02T13:00:00Z'), 'u=1')).toBeNull()
  })
})

describe('Bluesky length', () => {
  const long = 'Acme Widgets Incorporated of North America and Affiliated Companies Holdings and Subsidiaries Group'
  it('keeps a filing post under 300 characters with the whole link counted, and under 280 with X short links', () => {
    const f = { employer: long, state: 'WA', workers: 1985, date: new Date('2026-05-13T12:00:00Z'), path: '/layoffs/company/acme-widgets' }
    expect(filingPostText(f, 'utm_source=bluesky&utm_medium=social&utm_campaign=warn-filing', false).length).toBeLessThanOrEqual(300)
  })
})

describe('announcementBasis', () => {
  it('reads how the layoff was sourced and the share of staff', () => {
    expect(announcementBasis('SEC 8-K Item 2.05 (restructuring filing) · 19% of staff')).toEqual({ basis: 'sec', percent: 19 })
    expect(announcementBasis('Reported by 2+ publishers')).toEqual({ basis: 'confirmed', percent: null })
    expect(announcementBasis('Reported by 1 publisher — unconfirmed · 8% of staff').basis).toBe('unconfirmed')
    expect(announcementBasis('Reported by 1 publisher (Reuters) — unconfirmed').basis).toBe('unconfirmed')
    expect(announcementBasis('Reported by 2 publishers').basis).toBe('confirmed')
    expect(announcementBasis('Reported by 4 publishers').basis).toBe('confirmed')
    expect(announcementBasis('Reported by 3 publishers · 19% of staff')).toEqual({ basis: 'confirmed', percent: 19 })
    expect(announcementBasis('Company shutdown announced Oct 30, effective Nov 6 · reported by 2+ publishers').basis).toBe('confirmed')
    expect(announcementBasis(null).basis).toBe('unconfirmed')
  })
})

describe('announcementPostText', () => {
  const base = { employer: 'Acme Corp', state: 'WA', workers: 1200, percent: 8, basis: 'sec' as const, path: '/layoffs/company/acme' }
  it('says who reported it, and keeps a share of staff apart from the headcount', () => {
    const t = announcementPostText(base, 'utm_source=bluesky', false)
    expect(t).toContain('Acme Corp announced layoffs in Washington, affecting 1,200 workers (8% of staff), according to an SEC filing.')
    expect(t).toContain('https://launchyournextchapter.com/layoffs/company/acme?utm_source=bluesky')
  })
  it('does not turn a percent into a headcount', () => {
    const t = announcementPostText({ ...base, workers: null, percent: 19, basis: 'confirmed' }, 'u=1', false)
    expect(t).toContain('affecting 19% of staff, according to multiple news reports')
    expect(t).not.toMatch(/19 workers/)
  })
  it('fits Bluesky with a very long employer name', () => {
    const t = announcementPostText({ ...base, employer: 'Acme Widgets Incorporated of North America and Affiliated Companies Holdings and Subsidiaries Group' }, 'utm_source=bluesky&utm_medium=social&utm_campaign=layoff-announcement', false)
    expect(t.length).toBeLessThanOrEqual(300)
  })
})

describe('BLS release posts', () => {
  const jobs = { month: { year: 2026, month: 10 }, prevMonth: { year: 2026, month: 9 }, payrollChange: 119_000, rate: 4.4, prevRate: 4.3 }
  it('posts the jobs report as all workers, all industries, keyed by month', () => {
    const p = jobsReportPost(jobs, 'utm_source=bluesky', false)
    expect(p.key).toBe('bls-jobs-2026-10')
    expect(p.text).toContain('BLS jobs report for October 2026: payroll employment +119,000 jobs.')
    expect(p.text).toContain('The unemployment rate was 4.4% (September: 4.3%)')
    expect(p.text).not.toMatch(/\b(up|down|added|cut)\b/)
    expect(p.text).toContain('All workers, all industries')
    expect(p.text.length).toBeLessThanOrEqual(300)
  })
  it('shows a loss with its sign, and a flat month as unchanged, never as a direction', () => {
    const p = jobsReportPost({ ...jobs, payrollChange: -20_000, rate: 4.3 }, 'u=1', false)
    expect(p.text).toContain('payroll employment -20,000 jobs')
    expect(p.text).toContain('4.3% (September: 4.3%)')
    expect(jobsReportPost({ ...jobs, payrollChange: 0 }, 'u=1', false).text).toContain('payroll employment unchanged')
  })
  it('posts JOLTS openings and layoffs in millions, labeled all industries', () => {
    const p = joltsPost({ month: { year: 2026, month: 9 }, prevMonth: { year: 2026, month: 8 }, openings: 7_227_000, layoffs: 1_800_000, prevLayoffs: 1_700_000 }, 'utm_source=bluesky', false)
    expect(p.key).toBe('bls-jolts-2026-09')
    expect(p.text).toContain('7.2 million job openings and 1.8 million layoffs and discharges (August: 1.7 million)')
    expect(p.text).not.toMatch(/\b(up|down) from\b/)
    expect(p.text).toContain('All industries')
    expect(p.text.length).toBeLessThanOrEqual(300)
  })
})

describe('isClosure', () => {
  it('flags shutdowns so they are not posted as layoffs', () => {
    expect(isClosure('Company shutdown announced Oct 30, effective Nov 6 · reported by 2+ publishers')).toBe(true)
    expect(isClosure('Reported by 3 publishers · 19% of staff')).toBe(false)
    expect(isClosure(null)).toBe(false)
  })
})

describe('splitFilingEmployer', () => {
  it('turns a street address into a city, the way a person would say it', () => {
    expect(splitFilingEmployer('GEICO 3535 W Pipkin Road LAKELAND, FL, 33811')).toEqual({ name: 'GEICO', city: 'Lakeland' })
    expect(splitFilingEmployer('Acme Corp 100 Main Street Salt Lake City, UT 84101')).toEqual({ name: 'Acme Corp', city: 'Salt Lake City' })
  })
  it('leaves any other employer untouched', () => {
    expect(splitFilingEmployer('Squarespace')).toEqual({ name: 'Squarespace', city: null })
    expect(splitFilingEmployer('3M Company')).toEqual({ name: '3M Company', city: null })
  })
  it('says the site in a filing post, with no street or zip', () => {
    const t = filingPostText({ employer: 'Geico', state: 'FL', city: 'Lakeland', workers: 114, date: new Date('2026-11-02T12:00:00Z'), path: '/layoffs/company/geico' }, 'u=1', false)
    expect(t).toContain('Geico filed a WARN layoff notice for its Lakeland, Florida site on Nov 2, naming 114 workers.')
    expect(t).not.toMatch(/Pipkin|33811/)
  })
})
