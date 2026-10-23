/**
 * Google Calendar booking page ("30 min with Justin", weekdays 9-5 Eastern,
 * Google Meet added) on the justin@launchyournextchapter.com calendar. A
 * booking lands on that calendar, so the CRM's calendar sweep picks it up and
 * Gemini takes notes. Set BOOKING_URL to point somewhere else without a deploy.
 */
export const BOOKING_URL =
  process.env.BOOKING_URL ||
  'https://calendar.google.com/calendar/appointments/schedules/AcZssZ2GKlEcp8oJsNxyeMskTAaNc2hSLWReu6cDAJTlJG74vlTu-76ptMa7SSV4dkHSrLXO0_zEez3h'

/** Mail scanners and link-checkers fetch every link in a message; their hits aren't a person choosing to book. */
export function looksLikeScanner(userAgent: string | null): boolean {
  return !userAgent || /bot|crawl|spider|scanner|proofpoint|mimecast|barracuda|safelinks|curl|wget|python-requests|headless/i.test(userAgent)
}
