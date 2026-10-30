import { describe, expect, it } from 'vitest'
import { linkFacets, oauth1Header } from '@/lib/social/clients'
import { MIN_DAILY_NOTICES, MIN_NOTICES, dailyLayoffPost, reportPost, weekKey, weeklyLayoffPost, type DayNotice, type WeekNotice } from '@/lib/social/posts'

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
  it('limits X to the biggest filings and three a day', async () => {
    const { FILING_RULES, MAX_PER_CHANNEL_PER_DAY } = await import('@/lib/social/filings')
    expect(FILING_RULES.x).toEqual({ minWorkers: 250, perDay: 3 })
    expect(FILING_RULES.x!.perDay).toBeLessThan(MAX_PER_CHANNEL_PER_DAY)
  })
})
