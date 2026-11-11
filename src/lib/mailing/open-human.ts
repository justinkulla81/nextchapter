// Resend's "opened" event carries the address, browser and time of the open (`open.ipAddress`, `open.userAgent`,
// `open.timestamp`). The Resend webhook judges every open as it arrives, by address, browser and timing (isHumanOpen in
// click-human.ts, which adds Apple Mail Privacy Protection to the click rules), and keeps only a person's open in
// MailingEditionRecipient.openCount / openedAt. Machine opens (a mail scanner, Apple Mail Privacy Protection) are saved in
// MailingOpenEvent with bot = true and never counted. So the stored count already is the human count.
//
// The window below is still the one that separates a scanner's visit from a person's: a visit through an email link inside it
// is the mail scanner checking the link (the visitor log uses it).
//
// Known limits, as of 2026-11-11:
// - Opens before Resend's event history begins (2026-10-13 17:56 UTC) could not be re-checked and keep the counts they had
//   before these rules (34 opens at the time), so they can still include a machine's open.
// - Apple Mail readers: Apple loads the pixel for them on delivery, from its own addresses or through a relay that sends the
//   bare browser string "Mozilla/5.0", so their reads cannot be told from the automatic load. They show as unopened, and real
//   readership is higher than the human open count.
// - A slow scanner on a quiet address can pass the rules and count as human (about 36 opens did when the counts were restated).
export const PREFETCH_OPEN_WINDOW_MS = 2 * 60 * 1000

export interface OpenFacts {
  openCount: number
}

/** Human opens of a list email: the stored count, which the webhook already restricts to human opens. */
export function humanOpenCount(o: OpenFacts): number {
  return Math.max(0, o.openCount)
}
