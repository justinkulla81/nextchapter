import { describe, expect, it } from 'vitest'
import { newsFrom, newsNames, papersFrom, patentsSearchUrl } from '@/lib/higher-ed/research-feed'

describe('papersFrom', () => {
  it('keeps only articles with an author at the college, cleans titles, newest first', () => {
    const papers = papersFrom(
      [
        { DOI: '10.1/a', title: ['Old <i>catalyst</i> study'], published: { 'date-parts': [[2026, 2, 3]] }, author: [{ given: 'A', family: 'B', affiliation: [{ name: 'Department of Chemical Engineering, Carnegie Mellon University' }] }] },
        { DOI: '10.1/b', title: ['Elsewhere'], published: { 'date-parts': [[2026, 9]] }, author: [{ given: 'C', family: 'D', affiliation: [{ name: 'Other University' }] }] },
        { DOI: '10.1/c', title: ['New &amp; better'], 'container-title': ['J. Chem.'], published: { 'date-parts': [[2026, 9, 1]] }, author: [{ given: 'E', family: 'F', affiliation: [{ name: 'carnegie mellon university, Pittsburgh' }] }] },
      ],
      'Carnegie Mellon University',
    )
    expect(papers.map((p) => [p.doi, p.title, p.date])).toEqual([
      ['10.1/c', 'New & better', '2026-09-01'],
      ['10.1/a', 'Old catalyst study', '2026-02-03'],
    ])
    expect(papers[0].authors).toEqual(['E F'])
  })
})

describe('newsFrom', () => {
  it('reads Google News items and drops the source suffix and foreign links', () => {
    const xml = `<rss><channel>
      <item><title>Alumnus builds a startup - The Paper</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Tue, 13 Oct 2026 07:00:00 GMT</pubDate><source url="https://x">The Paper</source></item>
      <item><title>Bad link</title><link>https://evil.example/x</link><pubDate>Tue, 13 Oct 2026 07:00:00 GMT</pubDate></item>
    </channel></rss>`
    expect(newsFrom(xml)).toEqual([{ title: 'Alumnus builds a startup', source: 'The Paper', date: '2026-10-13', url: 'https://news.google.com/rss/articles/abc' }])
  })
})

describe('patentsSearchUrl', () => {
  it('searches Google Patents for the college and field, newest first', () => {
    const u = new URL(patentsSearchUrl('Carnegie Mellon University', 'chemical engineering'))
    expect(u.host).toBe('patents.google.com')
    expect(u.searchParams.get('assignee')).toBe('Carnegie Mellon University')
    expect(u.searchParams.get('q')).toBe('chemical engineering')
  })
})

describe('newsNames', () => {
  it('uses the full name and the name without University, never a one-word name', () => {
    expect(newsNames('Carnegie Mellon University')).toEqual(['Carnegie Mellon University', 'Carnegie Mellon'])
    expect(newsNames('Washington & Jefferson College')).toEqual(['Washington & Jefferson College', 'Washington & Jefferson'])
    expect(newsNames('Purdue University')).toEqual(['Purdue University'])
  })
})
