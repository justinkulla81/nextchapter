import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// A CSP wildcard (https://*.analytics.google.com) does not match the bare host, and Google Analytics sends its page views and events
// to https://analytics.google.com/g/collect. With only the wildcard, Chrome blocked every hit before it left the page.
const config = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8')
const connectSrc = config.split('\n').find((l) => l.includes("`connect-src 'self'")) ?? ''
const hosts = connectSrc.split(/\s+/)

describe('content security policy: Google Analytics', () => {
  it('lets the page send hits to the bare analytics.google.com host', () => {
    expect(hosts).toContain('https://analytics.google.com')
  })

  it('keeps the other hosts Google Analytics and the ad tags use', () => {
    for (const h of ['https://www.google-analytics.com', 'https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://www.googletagmanager.com', 'https://stats.g.doubleclick.net', 'https://*.g.doubleclick.net']) {
      expect(hosts).toContain(h)
    }
  })
})
