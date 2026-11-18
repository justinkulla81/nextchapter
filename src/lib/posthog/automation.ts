/**
 * Signals that a page view comes from an automated browser, recorded on every analytics event so a burst of such
 * visits can be separated from people. Nothing is dropped: the events are kept, flagged, and filtered in reports.
 * Background: on 28 Oct and 4 Nov 2026, 191 and 89 one-page sessions from identical Linux Chrome 155 browsers (US, DE, FR,
 * GB, SG, HK, JP) opened /onboarding/desire with no referrer and left. PostHog's own bot check flagged none of them.
 * Ordinary-Chrome visitors that this check cannot see are separated by interaction instead: see human-interaction.ts.
 *
 * Mail-security scanners (corporate link checkers that open every link in an email and click everything on the page) run ordinary
 * desktop Chrome and do "interact", so neither check sees them. They share a fingerprint instead: the window fills the whole screen
 * (no browser frame or taskbar) and the clock says Los Angeles while the machine sits in a data centre in Dublin, Amsterdam, Virginia
 * or Toronto. In the 30 days to 2026-11-18 about 12,600 of ~21,000 sessions had it, and none of them was a signed-in member or
 * opened the dashboard (all 24 identified people and 855 dashboard views were outside it). Phones are left out: a phone's window
 * fills its screen by design.
 */
export interface NavigatorLike {
  webdriver?: boolean
  userAgent?: string
}

export interface WindowLike {
  innerWidth: number
  innerHeight: number
  screen: { width: number; height: number }
  /** Intl.DateTimeFormat().resolvedOptions().timeZone */
  timeZone?: string
}

const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod/i

/** The scanner fingerprint above: a desktop window exactly the size of the screen, on Los Angeles time. */
export function scannerFingerprint(nav: NavigatorLike, win: WindowLike | null | undefined): boolean {
  if (!win || MOBILE_UA.test(nav.userAgent ?? '')) return false
  return win.innerWidth === win.screen.width && win.innerHeight === win.screen.height && win.timeZone === 'America/Los_Angeles'
}

const AUTOMATION_UA = /HeadlessChrome|PhantomJS|Playwright|Puppeteer|Selenium|Lighthouse|Chrome-Lighthouse/i

export function automationSignals(nav: NavigatorLike, win?: WindowLike | null): { automation_suspected: boolean; navigator_webdriver: boolean; scanner_suspected: boolean } {
  const webdriver = nav.webdriver === true
  const scanner = scannerFingerprint(nav, win)
  return { automation_suspected: webdriver || scanner || AUTOMATION_UA.test(nav.userAgent ?? ''), navigator_webdriver: webdriver, scanner_suspected: scanner }
}

/** The page's window, for automationSignals. Null where it cannot be read. */
export function currentWindow(): WindowLike | null {
  try {
    return { innerWidth: window.innerWidth, innerHeight: window.innerHeight, screen: { width: window.screen.width, height: window.screen.height }, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }
  } catch {
    return null
  }
}
