// What an employer may say next to a WARN notice. Pure, so the rules are tested. The statement is plain text, one to a
// few sentences: no links, no email addresses, no markup. A person reads every statement before it is shown.

export const STATEMENT_MIN = 40
export const STATEMENT_MAX = 800

export type StatementCheck = { ok: true; text: string } | { ok: false; message: string }

const URL_LIKE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|us|gov|edu)\b)/i
const EMAIL_LIKE = /[^\s@]+@[^\s@]+\.[^\s@]+/

export function checkStatementText(raw: string): StatementCheck {
  const text = raw.replace(/\s+/g, ' ').trim()
  if (text.length < STATEMENT_MIN) return { ok: false, message: `Write at least ${STATEMENT_MIN} characters, so the statement says something.` }
  if (text.length > STATEMENT_MAX) return { ok: false, message: `Keep the statement to ${STATEMENT_MAX} characters or fewer. It is ${text.length}.` }
  if (/[<>]/.test(text)) return { ok: false, message: 'Use plain text only, without angle brackets.' }
  if (EMAIL_LIKE.test(text)) return { ok: false, message: 'Leave out email addresses. Statements are plain text.' }
  if (URL_LIKE.test(text)) return { ok: false, message: 'Leave out links and web addresses. Statements are plain text.' }
  return { ok: true, text }
}

export type StatementStatus = 'PENDING_EMAIL' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'

/** At most this many statement requests per IP and per email address in an hour. */
export const MAX_STATEMENTS_PER_IP_PER_HOUR = 5
export const MAX_STATEMENTS_PER_EMAIL_PER_HOUR = 3
