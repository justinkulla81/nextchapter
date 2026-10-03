import { describe, it, expect } from 'vitest'
import { detectNewsKind, instagramPermalink, safeImageUrl, sourceFromUrl, videoEmbedUrl, vimeoId, youtubeId } from '@/lib/news/kind'

describe('youtubeId', () => {
  it('reads every link shape YouTube hands out', () => {
    for (const url of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10s',
      'https://www.youtube.com/live/dQw4w9WgXcQ',
    ]) expect(youtubeId(url)).toBe('dQw4w9WgXcQ')
  })
  it('is not fooled by a channel page or another site', () => {
    expect(youtubeId('https://www.youtube.com/@nextchapter')).toBeNull()
    expect(youtubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeId('not a url')).toBeNull()
  })
})

describe('instagramPermalink', () => {
  it('strips tracking and a username prefix down to the embeddable link', () => {
    expect(instagramPermalink('https://www.instagram.com/p/CxYz_12-ab/?utm_source=ig_web_copy_link&igsh=x'))
      .toBe('https://www.instagram.com/p/CxYz_12-ab/')
    expect(instagramPermalink('https://instagram.com/nextchapter/reel/CxYz/')).toBe('https://www.instagram.com/reel/CxYz/')
    expect(instagramPermalink('https://www.instagram.com/reels/CxYz/')).toBe('https://www.instagram.com/reel/CxYz/')
  })
  it('refuses a profile or story, which cannot be embedded', () => {
    expect(instagramPermalink('https://www.instagram.com/nextchapter/')).toBeNull()
    expect(instagramPermalink('https://www.instagram.com/stories/nextchapter/123/')).toBeNull()
  })
})

describe('detectNewsKind', () => {
  it('sorts links into the three kinds', () => {
    expect(detectNewsKind('https://youtu.be/dQw4w9WgXcQ')).toBe('video')
    expect(detectNewsKind('https://vimeo.com/123456789')).toBe('video')
    expect(detectNewsKind('https://www.instagram.com/p/CxYz/')).toBe('instagram')
    expect(detectNewsKind('https://www.inc.com/some/article')).toBe('article')
  })
  it('treats a video on a host we cannot play as an article link', () => {
    expect(detectNewsKind('https://www.linkedin.com/posts/someone_video-123')).toBe('article')
    // An Instagram profile is a link out, not an embed.
    expect(detectNewsKind('https://www.instagram.com/nextchapter/')).toBe('article')
  })
})

describe('videoEmbedUrl', () => {
  it('builds the privacy-friendly player address', () => {
    expect(videoEmbedUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0')
    expect(vimeoId('https://vimeo.com/channels/staffpicks/123456789')).toBe('123456789')
    expect(videoEmbedUrl('https://vimeo.com/123456789')).toBe('https://player.vimeo.com/video/123456789?autoplay=1')
    expect(videoEmbedUrl('https://www.inc.com/x')).toBeNull()
  })
})

describe('safeImageUrl', () => {
  it('keeps https, resolves a relative path, and drops everything else', () => {
    expect(safeImageUrl('https://cdn.example.com/a.jpg')).toBe('https://cdn.example.com/a.jpg')
    expect(safeImageUrl('/img/a.jpg', 'https://example.com/story')).toBe('https://example.com/img/a.jpg')
    expect(safeImageUrl('http://example.com/a.jpg')).toBeNull()
    expect(safeImageUrl('javascript:alert(1)')).toBeNull()
    expect(safeImageUrl(null)).toBeNull()
  })
})

describe('sourceFromUrl', () => {
  it('names the site without the www', () => {
    expect(sourceFromUrl('https://www.inc.com/a/b')).toBe('inc.com')
  })
})

import { linkedinEmbedUrl, podcastEmbed, embedsItself } from '@/lib/news/kind'
import { cleanNewsTags } from '@/lib/news/tags'

describe('linkedinEmbedUrl', () => {
  it('reads the id from a copied share link and from a feed link', () => {
    expect(linkedinEmbedUrl('https://www.linkedin.com/posts/justinkulla_nextchapter-hiring-activity-7245678901234567890-AbCd?utm_source=share'))
      .toBe('https://www.linkedin.com/embed/feed/update/urn:li:activity:7245678901234567890')
    expect(linkedinEmbedUrl('https://www.linkedin.com/feed/update/urn:li:share:7245678901234567890/'))
      .toBe('https://www.linkedin.com/embed/feed/update/urn:li:share:7245678901234567890')
    expect(linkedinEmbedUrl('https://www.linkedin.com/feed/update/urn%3Ali%3AugcPost%3A7245678901234567890'))
      .toBe('https://www.linkedin.com/embed/feed/update/urn:li:ugcPost:7245678901234567890')
  })
  it('leaves an article, a profile and a company page as plain links', () => {
    expect(linkedinEmbedUrl('https://www.linkedin.com/pulse/some-article-justin-kulla/')).toBeNull()
    expect(linkedinEmbedUrl('https://www.linkedin.com/in/justinkulla/')).toBeNull()
    expect(linkedinEmbedUrl('https://www.linkedin.com/company/launchyournextchapter/')).toBeNull()
    expect(detectNewsKind('https://www.linkedin.com/pulse/some-article-justin-kulla/')).toBe('article')
  })
})

describe('podcastEmbed', () => {
  it('builds the Spotify player for an episode and a show', () => {
    expect(podcastEmbed('https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=abc'))
      .toEqual({ src: 'https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk', height: 152, host: 'Spotify' })
    expect(podcastEmbed('https://open.spotify.com/intl-de/show/2MAi0BvDc6GTFvKFPXnkCL')?.height).toBe(232)
    // Music is not a podcast.
    expect(podcastEmbed('https://open.spotify.com/track/4rOoJ6Egrf8K2IrywzwOMk')).toBeNull()
  })
  it('builds the Apple player, keeping the episode and dropping tracking', () => {
    expect(podcastEmbed('https://podcasts.apple.com/us/podcast/the-daily/id1200361736?i=1000123456789&uo=4'))
      .toEqual({ src: 'https://embed.podcasts.apple.com/us/podcast/the-daily/id1200361736?i=1000123456789', height: 175, host: 'Apple Podcasts' })
    expect(podcastEmbed('https://podcasts.apple.com/us/podcast/the-daily/id1200361736')?.height).toBe(175)
    expect(podcastEmbed('https://music.apple.com/us/album/x/123')).toBeNull()
  })
  it('makes podcast and LinkedIn links their own kinds', () => {
    expect(detectNewsKind('https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk')).toBe('podcast')
    expect(detectNewsKind('https://www.linkedin.com/feed/update/urn:li:activity:7245678901234567890')).toBe('linkedin')
    expect(embedsItself('linkedin', 'https://www.linkedin.com/in/justinkulla/')).toBe(false)
    expect(embedsItself('podcast', 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk')).toBe(true)
    expect(embedsItself('article', 'https://www.inc.com/x')).toBe(false)
  })
})

describe('cleanNewsTags', () => {
  it('keeps known tags in list order and drops the rest', () => {
    expect(cleanNewsTags(['motivation', 'bogus', 'news', 'news', 42])).toEqual(['news', 'motivation'])
    expect(cleanNewsTags([])).toEqual([])
  })
})

import { parseFeed, unwrapFeedLink } from '@/lib/news/discover'

describe('unwrapFeedLink', () => {
  it('returns the publisher address from a tracking redirect, without tracking parameters', () => {
    expect(unwrapFeedLink('http://www.bing.com/news/apiclick.aspx?ref=FexRss&aid=&tid=abc&url=https%3a%2f%2fwww.forbes.com%2fsites%2fx%2fstory%2f%3futm_source%3dbing%26id%3d7&c=1&mkt=en-us'))
      .toBe('https://www.forbes.com/sites/x/story/?id=7')
  })
  it('refuses a redirect with nothing inside it', () => {
    expect(unwrapFeedLink('http://www.bing.com/news/apiclick.aspx?ref=FexRss')).toBeNull()
    expect(unwrapFeedLink('not a link')).toBeNull()
  })
})

describe('parseFeed', () => {
  it('reads headline, source, snippet and date from each item', () => {
    const xml = `<?xml version="1.0"?><rss xmlns:News="https://www.bing.com/news/search?format=rss"><channel>
      <item><title>Long-term unemployment hits a high</title>
        <link>http://www.bing.com/news/apiclick.aspx?url=https%3a%2f%2fexample.com%2fa&amp;c=1</link>
        <description>The share of the jobless out six months or more rose.</description>
        <pubDate>Wed, 16 Sep 2026 10:27:00 GMT</pubDate><News:Source>Example News</News:Source>
        <News:Image>https://www.bing.com/th?id=ABC&amp;pid=News</News:Image></item>
      <item><title></title><link>http://www.bing.com/news/apiclick.aspx?url=https%3a%2f%2fexample.com%2fb</link></item>
    </channel></rss>`
    const items = parseFeed(xml)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      url: 'https://example.com/a', title: 'Long-term unemployment hits a high',
      source: 'Example News', description: 'The share of the jobless out six months or more rose.',
    })
    expect(items[0].publishedAt?.toISOString()).toBe('2026-09-16T10:27:00.000Z')
  })
})

import { stripSourceSuffix } from '@/lib/news/kind'

describe('stripSourceSuffix', () => {
  it('drops the publisher name from the end of a headline', () => {
    expect(stripSourceSuffix('The US economy added just 29,000 jobs | CNN Business', 'CNN')).toBe('The US economy added just 29,000 jobs')
    expect(stripSourceSuffix('Reskilling in the Age of AI - Harvard Business Review', 'Harvard Business Review')).toBe('Reskilling in the Age of AI')
    expect(stripSourceSuffix('Work & careers | The Guardian', 'theguardian.com')).toBe('Work & careers')
  })
  it('leaves a headline whose last part is not the source', () => {
    expect(stripSourceSuffix('Layoffs rise - and so does long-term unemployment', 'CNN')).toBe('Layoffs rise - and so does long-term unemployment')
    expect(stripSourceSuffix('Mid-career pivots', 'CNN')).toBe('Mid-career pivots')
    expect(stripSourceSuffix(null, 'CNN')).toBeNull()
  })
})

import { newsSlug, newsDisplayTitle } from '@/lib/news/slug'
import { cleanEmployer, readableType } from '@/lib/warn/public-tracker'

describe('newsSlug', () => {
  it('makes a readable address ending in part of the id', () => {
    expect(newsSlug('The US economy added just 29,000 jobs last month — and it’s worse than it looks', 'article', 'cmur3eaey0000m406eagu5tky'))
      .toBe('the-us-economy-added-just-29-000-jobs-last-month-gu5tky')
  })
  it('falls back when there is no headline', () => {
    expect(newsSlug(null, 'linkedin Gary Vaynerchuk', 'cmur4i8gl0000jt043jl50n1g')).toBe('linkedin-gary-vaynerchuk-l50n1g')
    expect(newsSlug('', '', 'abc123456')).toBe('item-123456')
  })
})

describe('newsDisplayTitle', () => {
  it('names a post by its author when it has no headline', () => {
    expect(newsDisplayTitle({ title: null, kind: 'linkedin', source: 'Gary Vaynerchuk' })).toBe('LinkedIn post by Gary Vaynerchuk')
    expect(newsDisplayTitle({ title: null, kind: 'instagram', source: 'Instagram' })).toBe('Instagram post')
    expect(newsDisplayTitle({ title: 'A headline', kind: 'article', source: 'CNN' })).toBe('A headline')
  })
})

describe('cleanEmployer', () => {
  it('drops a site address filed in the same cell as the name', () => {
    expect(cleanEmployer('Saddle Creek Corporation 771 S. County Line Road PLANT CITY, FL, 33566', 'Saddle Creek Corporation')).toBe('Saddle Creek Corporation')
    expect(cleanEmployer('Health First Inc., and Health First Shared Services, Inc. 6450 US Highway 1 ROCKLEDGE, FL, 32955', null))
      .toBe('Health First Inc., and Health First Shared Services, Inc.')
  })
  it('drops a trailing city, state and zip when there is no street number to cut at', () => {
    expect(cleanEmployer('Amentum Space Commerce Way, Merritt Island Kennedy Space Center MERRITT ISLAND, FL, 32899', null))
      .toBe('Amentum Space Commerce Way, Merritt Island Kennedy Space Center')
  })
  it('leaves an ordinary name alone, digits and all', () => {
    expect(cleanEmployer('Capstone Delivery Inc.', 'Capstone Delivery Inc.')).toBe('Capstone Delivery Inc.')
    expect(cleanEmployer('3M Company', null)).toBe('3M Company')
    expect(cleanEmployer('Kaiser (1840 California Ave.)', null)).toBe('Kaiser (1840 California Ave.)')
  })
})

describe('readableType', () => {
  it('keeps words and drops codes', () => {
    expect(readableType('Closure Permanent')).toBe('Closure Permanent')
    expect(readableType('CL')).toBeNull()
    expect(readableType(null)).toBeNull()
  })
})

import { parseTexasWorkbook } from '@/lib/warn/sources'

describe('parseTexasWorkbook', () => {
  const sheet = (rows: string[][]) => [{ name: 'Sheet1', rows }]
  const HEADER = ['NOTICE_DATE', 'JOB_SITE_NAME', 'COUNTY_NAME', 'WDA_NAME', 'TOTAL_LAYOFF_NUMBER', 'LayOff_Date', 'WFDD_RECEIVED_DATE', 'CITY_NAME']

  it('reads a notice, turning Excel day numbers into dates', () => {
    const rows = parseTexasWorkbook(sheet([HEADER, ['46295', 'Charter Next Generation', 'Dallas', 'Dallas County WDA', '56', '46356', '46295', 'Grand Prairie']]))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ state: 'TX', employer: 'Charter Next Generation', county: 'Dallas', address: 'Grand Prairie', employees: 56, industry: null })
    expect(rows[0].noticeDate?.toISOString().slice(0, 10)).toBe('2026-09-30')
    expect(rows[0].effectiveDate?.toISOString().slice(0, 10)).toBe('2026-11-30')
  })
  it('skips blank rows and tolerates a missing headcount', () => {
    const rows = parseTexasWorkbook(sheet([HEADER, ['', '', '', '', '', '', '', ''], ['46290', 'Acme', 'Collin', 'x', '', '', '46290', 'Plano']]))
    expect(rows).toHaveLength(1)
    expect(rows[0].employees).toBeNull()
    expect(rows[0].effectiveDate).toBeNull()
  })
  it('fails loudly when the state renames its columns', () => {
    expect(() => parseTexasWorkbook(sheet([['Date', 'Company'], ['46290', 'Acme']]))).toThrow(/NOTICE_DATE/)
  })
})

import { readLayoffHeadline, publisherKey, sameEmployer } from '@/lib/warn/news-headline'

describe('readLayoffHeadline', () => {
  it('reads the company and headcount from the usual shapes', () => {
    expect(readLayoffHeadline("Disney lays off around 300 employees as D'Amaro pushes cost cuts")).toMatchObject({ company: 'Disney', employees: 300 })
    expect(readLayoffHeadline('BioMarin laying off 119 employees')).toMatchObject({ company: 'BioMarin', employees: 119 })
    expect(readLayoffHeadline('Workday layoffs to impact over 140 Bay Area workers')).toMatchObject({ company: 'Workday', employees: 140 })
    expect(readLayoffHeadline('Intel to cut 15,000 jobs')).toMatchObject({ company: 'Intel', employees: 15000 })
    expect(readLayoffHeadline('Amazon cuts 14k corporate jobs')).toMatchObject({ company: 'Amazon', employees: 14000 })
    expect(readLayoffHeadline('Nike Announces Layoffs, Operating Changes as Q1 Sales Fall Further')).toMatchObject({ company: 'Nike', employees: null })
  })
  it('skips a subject that is a description, not a name', () => {
    expect(readLayoffHeadline('Global banking firm trims 75 jobs in N.J.')).toBeNull()
    expect(readLayoffHeadline('Banking giant plans to cut 75 jobs in N.J.')).toBeNull()
    expect(readLayoffHeadline('Health giant announces mass layoffs across California')).toBeNull()
    expect(readLayoffHeadline('Layoffs announced at 3 Central Florida companies')).toBeNull()
    expect(readLayoffHeadline('CDC staffing drops 30% as layoffs reshape agency')).toBeNull()
  })
  it('does not take a year for a headcount', () => {
    expect(readLayoffHeadline('Acme layoffs continue into 2026 workers say')?.employees ?? null).toBeNull()
  })
})

describe('publisherKey and sameEmployer', () => {
  it('treats a syndicated copy as the same publisher', () => {
    expect(publisherKey('CNBC on MSN')).toBe(publisherKey('CNBC'))
  })
  it('matches a company named with and without its full name, whole words only', () => {
    expect(sameEmployer('disney', 'walt disney')).toBe(true)
    expect(sameEmployer('nike', 'nike')).toBe(true)
    expect(sameEmployer('meta', 'metadata systems')).toBe(false)
    expect(sameEmployer('ibm', 'ibm corp')).toBe(false)
  })
})
