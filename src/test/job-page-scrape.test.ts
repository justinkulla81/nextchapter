import { describe, expect, it } from 'vitest'
import { isJobPageScrapeVisit, notJobPageScrapeSql } from '@/lib/http/job-page-scrape'

const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36'
const scrape = { views: 1, firstPath: '/jobs/cmuzssezy0mssjq0640voiqxq', userAgent: WIN, referrer: null, hasAccount: false }

describe('job-page scraper', () => {
  it('drops one lone job-page view on Windows Chrome with no referrer', () => {
    expect(isJobPageScrapeVisit(scrape)).toBe(true)
  })

  it('keeps anyone who did more, came from somewhere, or is signed in', () => {
    expect(isJobPageScrapeVisit({ ...scrape, views: 2 })).toBe(false)
    expect(isJobPageScrapeVisit({ ...scrape, referrer: 'https://www.google.com/' })).toBe(false)
    expect(isJobPageScrapeVisit({ ...scrape, hasAccount: true })).toBe(false)
    expect(isJobPageScrapeVisit({ ...scrape, firstPath: '/jobs/cmuzssezy0mssjq0640voiqxq?utm_source=chatgpt.com' })).toBe(false)
    expect(isJobPageScrapeVisit({ ...scrape, firstPath: '/jobs' })).toBe(false)
    expect(isJobPageScrapeVisit({ ...scrape, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1' })).toBe(false)
    expect(isJobPageScrapeVisit({ ...scrape, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36' })).toBe(false)
  })

  it('uses the same path and browser rule in SQL', () => {
    const sql = notJobPageScrapeSql.sql
    expect(sql).toContain(`'^/jobs/c[a-z0-9]{20,30}$'`)
    expect(sql).toContain(`'^Mozilla/5\\.0 \\(Windows NT 10\\.0; Win64; x64\\) .*Chrome/'`)
  })
})
