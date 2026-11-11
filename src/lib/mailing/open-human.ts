// The Resend webhook now judges every open as it arrives, by address, browser and timing (isHumanOpen in click-human.ts), and
// keeps only a person's open in MailingEditionRecipient.openCount / openedAt. Machine opens (a mail scanner, Apple Mail Privacy
// Protection) are saved in MailingOpenEvent with bot = true and never counted. So the stored count already is the human count.
//
// The window below is still the one that separates a scanner's visit from a person's: a visit through an email link inside it
// is the mail scanner checking the link (the visitor log uses it).
export const PREFETCH_OPEN_WINDOW_MS = 2 * 60 * 1000

export interface OpenFacts {
  openCount: number
}

/** Human opens of a list email: the stored count, which the webhook already restricts to human opens. */
export function humanOpenCount(o: OpenFacts): number {
  return Math.max(0, o.openCount)
}
