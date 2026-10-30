import { describe, expect, it } from 'vitest'
import { parseThreads, redditReply, redditSearchUrl, stateSubreddit, statePostDraft, type RedditNotice } from '@/lib/reddit/todo'

const notice: RedditNotice = {
  id: 'n1', state: 'TX', employer: 'Acme Widgets', slug: 'acme-widgets', place: 'Tarrant County', workers: 79,
  noticeDate: new Date('2026-10-07T12:00:00Z'), noticeDateKnown: true, effectiveDate: new Date('2026-12-06T12:00:00Z'), sourceUrl: 'https://www.twc.texas.gov/warn.xlsx',
}

describe('redditReply', () => {
  it('states only what the filing says and links the state record, benefits and the employer page', () => {
    const t = redditReply(notice)
    expect(t).toContain('Acme Widgets filed a WARN layoff notice for Tarrant County, Texas naming 79 workers, dated October 7, 2026, with layoffs effective December 6, 2026.')
    expect(t).toContain("The state's own record: https://www.twc.texas.gov/warn.xlsx")
    expect(t).toContain('https://launchyournextchapter.com/unemployment-benefits/texas')
    expect(t).toContain('/layoffs/company/acme-widgets?utm_source=reddit')
    expect(t).not.toMatch(/because|due to|restructur/i)
  })

  it('leaves out what the filing does not give', () => {
    const t = redditReply({ ...notice, workers: null, place: null, effectiveDate: null, sourceUrl: null })
    expect(t).toContain('Acme Widgets filed a WARN layoff notice in Texas, dated')
    expect(t).not.toContain('naming')
    expect(t).not.toContain("state's own record")
  })
})

describe('helpers', () => {
  it('names a state subreddit without spaces', () => {
    expect(stateSubreddit('NC')).toBe('NorthCarolina')
    expect(stateSubreddit('DC')).toBe('washingtondc')
  })
  it('builds a weekly state post from its own numbers', () => {
    const d = statePostDraft('CA', 12, 1500)
    expect(d.title).toBe('California filed 12 layoff notices in the last 7 days, naming 1,500 workers')
    expect(d.body).toContain('/layoffs/california?utm_source=reddit')
  })
  it('makes a search link for the last week', () => expect(redditSearchUrl('Acme layoffs')).toBe('https://www.reddit.com/search/?q=Acme%20layoffs&sort=new&t=week'))
})

describe('parseThreads', () => {
  const xml = `<feed><entry><title>Acme Widgets layoffs &amp; WARN</title><link href="https://www.reddit.com/r/layoffs/comments/abc/acme/"/></entry>
  <entry><title>Totally unrelated</title><link href="https://www.reddit.com/r/jobs/comments/def/x/"/></entry>
  <entry><title>Acme news</title><link href="https://evil.example.com/x"/></entry></feed>`
  it('keeps reddit threads that mention the employer, and nothing else', () => {
    const t = parseThreads(xml, 'Acme Widgets')
    expect(t).toEqual([{ title: 'Acme Widgets layoffs & WARN', url: 'https://www.reddit.com/r/layoffs/comments/abc/acme/', sub: 'layoffs' }])
  })
})
