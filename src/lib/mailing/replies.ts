/**
 * Reading inbound mail for the mailing lists, from headers and Gmail's
 * snippet alone — no extra fetch.
 */

/** Strips Re:/Fwd: prefixes and whitespace so a reply's subject matches the original. */
export function baseSubject(subject: string | null | undefined): string {
  let s = (subject ?? '').trim()
  for (;;) {
    const next = s.replace(/^\s*(re|fwd?|aw|sv)\s*(\[\d+\])?\s*:\s*/i, '')
    if (next === s) break
    s = next
  }
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

const ASK = /^(please\s+)?(unsubscribe|remove|remove me|take me off|stop)(\s+(me|please))?(\s+from\s+(this|the|your)\s+(list|emails?))?[\s.!]*$/i

/**
 * True when the reply is just "unsubscribe" / "remove" — the whole of what
 * they typed above the quoted original — or the subject is, as a
 * List-Unsubscribe mailto sends it.
 */
export function isUnsubscribeReply(subject: string | null | undefined, snippet: string | null | undefined): boolean {
  if (ASK.test(baseSubject(subject))) return true
  const typed = (snippet ?? '')
    .replace(/&#39;/g, "'")
    .split(/\bOn\s.{4,120}?\bwrote:|-{2,}\s*Original Message|\bFrom:\s/i)[0]
    .trim()
  return typed.length > 0 && typed.length <= 60 && ASK.test(typed)
}
