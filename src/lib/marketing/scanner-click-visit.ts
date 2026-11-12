// A mail-security gateway clicks a link in a recipient's email (Resend flags the click bot), then loads that page from a pool of
// addresses. The page view that follows is the scanner, not the recipient. Beth Moe, 2026-11-12: 41 bot clicks in 12 hours, none
// human, and a page view after each from five addresses in five cities.
//
// A visit is a scanner's when, within SCANNER_CLICK_WINDOW_SECS of it, a bot-flagged click was made on a link to the same page,
// and no human click was (that visit is the person), and the visiting address never made a human click in the days around it
// (a real reader who clicked, then opened the page again while the gateway re-scanned: 103.196.9.225, 2026-11-11).
// `scannerClickVisitSql` (the filter on the visit tables) and `isScannerClickVisit` (the same rule, in code) must agree.

export const SCANNER_CLICK_WINDOW_SECS = 30
export const HUMAN_IP_WINDOW_HOURS = 24

export interface ScannerClickVisit {
  at: Date
  ip: string | null
  path: string | null
  eventType: string
}

export interface MailClick {
  at: Date
  ip: string | null
  link: string
  bot: boolean
}

const pageOf = (path: string | null): string => (path ?? '').split('?')[0]

export function isScannerClickVisit(visit: ScannerClickVisit, clicks: MailClick[]): boolean {
  const page = pageOf(visit.path)
  if (visit.eventType !== 'PAGE_VIEW' || page.length <= 1) return false
  const near = (c: MailClick) => Math.abs(c.at.getTime() - visit.at.getTime()) <= SCANNER_CLICK_WINDOW_SECS * 1000 && c.link.includes(page)
  if (!clicks.some((c) => c.bot && near(c))) return false
  if (clicks.some((c) => !c.bot && near(c))) return false
  const ipWindow = HUMAN_IP_WINDOW_HOURS * 3600 * 1000
  return !(visit.ip && clicks.some((c) => !c.bot && c.ip === visit.ip && Math.abs(c.at.getTime() - visit.at.getTime()) <= ipWindow))
}

/** SQL for the rule, written against the visit table by its full name ("HomepageVisitEvent"). Fixed text, no user input. */
export const scannerClickVisitSql = `("eventType"::text = 'PAGE_VIEW' AND length(split_part("path", '?', 1)) > 1
    AND EXISTS (SELECT 1 FROM "MailingClickEvent" b WHERE b."bot"
      AND b."clickedAt" BETWEEN "HomepageVisitEvent"."createdAt" - make_interval(secs => ${SCANNER_CLICK_WINDOW_SECS}) AND "HomepageVisitEvent"."createdAt" + make_interval(secs => ${SCANNER_CLICK_WINDOW_SECS})
      AND position(split_part("path", '?', 1) in b."link") > 0)
    AND NOT EXISTS (SELECT 1 FROM "MailingClickEvent" h WHERE NOT h."bot"
      AND ((h."clickedAt" BETWEEN "HomepageVisitEvent"."createdAt" - make_interval(secs => ${SCANNER_CLICK_WINDOW_SECS}) AND "HomepageVisitEvent"."createdAt" + make_interval(secs => ${SCANNER_CLICK_WINDOW_SECS})
          AND position(split_part("path", '?', 1) in h."link") > 0)
        OR ("HomepageVisitEvent"."ip" IS NOT NULL AND h."ip" = "HomepageVisitEvent"."ip"
          AND h."clickedAt" BETWEEN "HomepageVisitEvent"."createdAt" - make_interval(hours => ${HUMAN_IP_WINDOW_HOURS}) AND "HomepageVisitEvent"."createdAt" + make_interval(hours => ${HUMAN_IP_WINDOW_HOURS})))))`
