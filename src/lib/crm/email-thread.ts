/**
 * Display-side helpers for the CRM History list. Synced email rows keep the
 * full message (including the quoted thread below the reply) in `body`; the
 * history shows only what the sender newly wrote, and groups the messages of
 * one conversation into a chain.
 */

// Where a reply stops and the quoted earlier thread begins. The earliest
// match wins. Gmail/Apple: "On <date>, <name> <addr> wrote:"; Outlook:
// "From: … Sent:/Date:" or a rule line; and plain ">" quote lines.
const QUOTE_MARKERS: RegExp[] = [
  /\bOn\s[^\n]{0,200}?\bwrote:/i,
  /-{2,}\s*(?:Original Message|Forwarded message)\s*-{2,}/i,
  /_{5,}\s*\n?\s*From:/i,
  /\bFrom:\s[^\n]{0,200}?\s(?:Sent|Date):\s/i,
  /(?:^|\s)>\s/,
]

export function latestReplyOnly(body: string | null | undefined): string {
  if (!body) return ''
  let end = body.length
  for (const re of QUOTE_MARKERS) {
    const m = re.exec(body)
    if (m && m.index < end) end = m.index
  }
  return body.slice(0, end).trim()
}

/** "Re: Fwd: Intro" and "intro" are the same conversation. */
export function threadKey(subject: string | null | undefined): string | null {
  const s = (subject ?? '').replace(/^\s*(?:(?:re|fwd?|aw)\s*:\s*)+/i, '').replace(/\s+/g, ' ').trim().toLowerCase()
  return s || null
}

export type Chain<T> = { key: string; messages: T[]; latest: Date }

/**
 * Groups emails into chains by normalised subject, messages oldest-first and
 * chains newest-activity-first. Email with no subject is its own chain.
 */
export function groupEmailChains<T extends { id: string; subject: string | null; occurredAt: Date }>(emails: T[]): Chain<T>[] {
  const byKey = new Map<string, T[]>()
  for (const e of emails) {
    const key = threadKey(e.subject) ?? `solo:${e.id}`
    byKey.set(key, [...(byKey.get(key) ?? []), e])
  }
  return [...byKey.entries()]
    .map(([key, messages]) => {
      messages.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime())
      return { key, messages, latest: messages[messages.length - 1].occurredAt }
    })
    .sort((a, b) => b.latest.getTime() - a.latest.getTime())
}
