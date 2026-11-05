import { describe, expect, it } from 'vitest'
import { automationSignals } from '@/lib/posthog/automation'

const CHROME_LINUX = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'

describe('automationSignals', () => {
  it('flags a webdriver browser', () => {
    expect(automationSignals({ webdriver: true, userAgent: CHROME_LINUX })).toEqual({ automation_suspected: true, navigator_webdriver: true })
  })
  it('flags a headless user agent even without webdriver', () => {
    expect(automationSignals({ webdriver: false, userAgent: CHROME_LINUX.replace('Chrome/', 'HeadlessChrome/') }).automation_suspected).toBe(true)
  })
  it('leaves an ordinary browser alone, Linux included', () => {
    expect(automationSignals({ webdriver: false, userAgent: CHROME_LINUX })).toEqual({ automation_suspected: false, navigator_webdriver: false })
    expect(automationSignals({})).toEqual({ automation_suspected: false, navigator_webdriver: false })
  })
})
