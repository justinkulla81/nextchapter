import { describe, expect, it } from 'vitest'
import { hostMatches, matchProfilePage, parseReviewForm, robotsAllows } from './external-reviews'

function form(values: Record<string, string>): FormData {
  const f = new FormData()
  for (const [k, v] of Object.entries(values)) f.set(k, v)
  return f
}

describe('parseReviewForm', () => {
  const base = { platform: 'toptal', profileUrl: 'https://www.toptal.com/resume/jane-doe', rating: '4.9', reviewCount: '23' }

  it('accepts a valid entry', () => {
    const r = parseReviewForm(form(base))
    expect(r).toEqual({
      ok: true,
      value: { platform: 'toptal', platformLabel: null, profileUrl: 'https://www.toptal.com/resume/jane-doe', rating: 4.9, reviewCount: 23, jobsCompleted: null },
    })
  })

  it('rejects a link on another site', () => {
    const r = parseReviewForm(form({ ...base, profileUrl: 'https://evil.example.com/toptal' }))
    expect(r.ok).toBe(false)
  })

  it('rejects http, bad ratings and zero reviews', () => {
    expect(parseReviewForm(form({ ...base, profileUrl: 'http://toptal.com/x' })).ok).toBe(false)
    expect(parseReviewForm(form({ ...base, rating: '6' })).ok).toBe(false)
    expect(parseReviewForm(form({ ...base, reviewCount: '0' })).ok).toBe(false)
    expect(parseReviewForm(form({ ...base, reviewCount: '2.5' })).ok).toBe(false)
  })

  it('needs a name for Other and accepts any https host', () => {
    expect(parseReviewForm(form({ ...base, platform: 'other', profileUrl: 'https://braintrust.com/u/x' })).ok).toBe(false)
    const r = parseReviewForm(form({ ...base, platform: 'other', platformLabel: 'Braintrust', profileUrl: 'https://braintrust.com/u/x', reviewCount: '1,204' }))
    expect(r.ok && r.value.reviewCount).toBe(1204)
  })
})

describe('hostMatches', () => {
  it('matches subdomains but not lookalikes', () => {
    expect(hostMatches('www.upwork.com', ['upwork.com'])).toBe(true)
    expect(hostMatches('notupwork.com', ['upwork.com'])).toBe(false)
    expect(hostMatches('upwork.com.evil.io', ['upwork.com'])).toBe(false)
  })
})

describe('robotsAllows', () => {
  const robots = `User-agent: *\nDisallow: /freelancers/\nAllow: /freelancers/public/\n\nUser-agent: NextChapterBot\nDisallow: /`
  it('uses our own group when present', () => {
    expect(robotsAllows(robots, '/anything')).toBe(false)
  })
  it('falls back to * and picks the longest rule', () => {
    expect(robotsAllows(robots, '/freelancers/x', 'OtherBot')).toBe(false)
    expect(robotsAllows(robots, '/freelancers/public/x', 'OtherBot')).toBe(true)
    expect(robotsAllows(robots, '/about', 'OtherBot')).toBe(true)
  })
  it('allows everything with no rules', () => {
    expect(robotsAllows('', '/x')).toBe(true)
    expect(robotsAllows('User-agent: *\nDisallow:', '/x')).toBe(true)
  })
})

describe('matchProfilePage', () => {
  const who = { firstName: 'Jane', lastName: 'Doe' }
  it('confirms name, rating and count', () => {
    const html = '<h1>Jane Doe</h1><span>4.9</span><span>(1,204 reviews)</span>'
    expect(matchProfilePage(html, who, { rating: 4.9, reviewCount: 1204 }).confirmed).toBe(true)
  })
  it('says what was missing', () => {
    const r = matchProfilePage('<h1>Jane Doe</h1><span>4.7</span><span>12 reviews</span>', who, { rating: 4.9, reviewCount: 12 })
    expect(r.confirmed).toBe(false)
    expect(r.note).toContain('the rating')
  })
  it('stops at a bot check', () => {
    expect(matchProfilePage('<title>Just a moment...</title>', who, { rating: 5, reviewCount: 3 }).confirmed).toBe(false)
  })
  it('does not read 14.9 as 4.9', () => {
    expect(matchProfilePage('Jane Doe 14.9 12', who, { rating: 4.9, reviewCount: 12 }).confirmed).toBe(false)
  })
})
