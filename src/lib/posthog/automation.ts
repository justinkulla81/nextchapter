/**
 * Signals that a page view comes from an automated browser, recorded on every analytics event so a burst of such
 * visits can be separated from people. Nothing is dropped: the events are kept, flagged, and filtered in reports.
 * Background: on 28 Oct and 4 Nov 2026, 191 and 89 one-page sessions from identical Linux Chrome 155 browsers (US, DE, FR,
 * GB, SG, HK, JP) opened /onboarding/desire with no referrer and left. PostHog's own bot check flagged none of them.
 */
export interface NavigatorLike {
  webdriver?: boolean
  userAgent?: string
}

const AUTOMATION_UA = /HeadlessChrome|PhantomJS|Playwright|Puppeteer|Selenium|Lighthouse|Chrome-Lighthouse/i

export function automationSignals(nav: NavigatorLike): { automation_suspected: boolean; navigator_webdriver: boolean } {
  const webdriver = nav.webdriver === true
  return { automation_suspected: webdriver || AUTOMATION_UA.test(nav.userAgent ?? ''), navigator_webdriver: webdriver }
}
