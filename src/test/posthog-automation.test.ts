import { describe, expect, it } from 'vitest'
import { automationSignals } from '@/lib/posthog/automation'

const CHROME_LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'

describe('automationSignals', () => {
  it('flags a webdriver browser', () => {
    expect(automationSignals({ webdriver: true, userAgent: CHROME_LINUX })).toEqual({ automation_suspected: true, navigator_webdriver: true, scanner_suspected: false })
  })
  it('flags a headless user agent even without webdriver', () => {
    expect(automationSignals({ webdriver: false, userAgent: CHROME_LINUX.replace('Chrome/', 'HeadlessChrome/') }).automation_suspected).toBe(true)
  })
  it('leaves an ordinary browser alone, Linux included', () => {
    expect(automationSignals({ webdriver: false, userAgent: CHROME_LINUX })).toEqual({ automation_suspected: false, navigator_webdriver: false, scanner_suspected: false })
    expect(automationSignals({})).toEqual({ automation_suspected: false, navigator_webdriver: false, scanner_suspected: false })
  })

  const WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'
  const full = { innerWidth: 1920, innerHeight: 1080, screen: { width: 1920, height: 1080 } }

  it('flags the mail-scanner fingerprint: a desktop window the size of the screen on Los Angeles time', () => {
    expect(automationSignals({ userAgent: WIN }, { ...full, timeZone: 'America/Los_Angeles' })).toEqual({ automation_suspected: true, navigator_webdriver: false, scanner_suspected: true })
  })
  it('leaves people alone: a normal window, another time zone, or a phone', () => {
    expect(automationSignals({ userAgent: WIN }, { ...full, innerHeight: 937, timeZone: 'America/Los_Angeles' }).scanner_suspected).toBe(false)
    expect(automationSignals({ userAgent: WIN }, { ...full, timeZone: 'America/New_York' }).scanner_suspected).toBe(false)
    const phone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    expect(automationSignals({ userAgent: phone }, { innerWidth: 390, innerHeight: 844, screen: { width: 390, height: 844 }, timeZone: 'America/Los_Angeles' }).scanner_suspected).toBe(false)
  })
})
