/**
 * Pure matching rules for the Gmail and Calendar sweeps.
 *
 * Kept free of Prisma and network calls so the decisions that matter — whose
 * mail gets logged, whose gets ignored, and what counts as a person at all —
 * are testable without a mailbox.
 */

/** Local-parts that are machinery, not people. */
const AUTOMATED_LOCAL = new Set([
  'no-reply', 'noreply', 'do-not-reply', 'donotreply', 'notifications', 'notification',
  'support', 'help', 'info', 'hello', 'contact', 'admin', 'postmaster', 'mailer-daemon',
  'bounce', 'bounces', 'news', 'newsletter', 'updates', 'alerts', 'alert', 'billing',
  'receipts', 'invoice', 'invoices', 'security', 'account', 'accounts', 'team',
])

/** Domains that never contain a business contact worth tracking. */
const AUTOMATED_DOMAIN = /(^|\.)(mailchimp|sendgrid|mailgun|substack|intercom|zendesk|calendly|docusign|stripe|slack|atlassian|notion|linear|github|google|apple|amazonses|postmarkapp|hubspot|salesforce|zoom)\.(com|net|io|org)$/i

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  // "Jane Doe <jane@x.com>" and bare addresses both arrive here.
  const m = String(raw).match(/<([^>]+)>/)
  const addr = (m ? m[1] : String(raw)).trim().toLowerCase()
  if (!addr.includes('@') || addr.includes(' ')) return null
  return addr
}

export function displayNameFrom(raw: string | null | undefined): string | null {
  if (!raw) return null
  const m = String(raw).match(/^\s*"?([^"<]+?)"?\s*</)
  const name = m?.[1]?.trim()
  return name && name.includes('@') === false ? name : null
}

/**
 * Gmail ignores dots and anything after a "+" in the local part, so
 * justin.kulla@gmail.com, justinkulla@gmail.com and justin.kulla+3@gmail.com
 * are one mailbox. Applied ONLY to gmail/googlemail addresses — other
 * providers treat dots as significant, and collapsing them there would merge
 * two different people.
 *
 * Used for self-detection, where getting it wrong flips a sent message to
 * INBOUND and corrupts reply detection.
 */
export function canonicalGmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return email
  return `${local.split('+')[0].replace(/\./g, '')}@gmail.com`
}

/** True for addresses that are machinery rather than a person. */
export function isAutomatedAddress(email: string): boolean {
  const [local, domain] = email.split('@')
  if (!local || !domain) return true
  if (AUTOMATED_LOCAL.has(local)) return true
  // reply+<hash>@, bounce-123@, notifications-xyz@
  if (/^(reply|bounce|notifications?|mailer)[+._-]/.test(local)) return true
  if (/^[0-9a-f]{16,}$/.test(local)) return true
  if (AUTOMATED_DOMAIN.test(domain)) return true
  return false
}

export interface SweepContext {
  /** Your own addresses — used to decide direction, never logged as a contact. */
  selfEmails: Set<string>
  /**
   * Candidate, coach and recruiter addresses. Excluded from BOTH logging and
   * suggestion: those are product relationships with their own systems of
   * record, and a large share of this mailbox is candidate correspondence that
   * has no business in a business-development tool.
   */
  internalEmails: Set<string>
  /** CRM person id by address. */
  crmByEmail: Map<string, string>
}

export type ParticipantOutcome =
  | { kind: 'self' }
  | { kind: 'internal' }
  | { kind: 'automated' }
  | { kind: 'crm'; personId: string }
  | { kind: 'unknown' }

export function classifyParticipant(email: string, ctx: SweepContext): ParticipantOutcome {
  if (isSelf(email, ctx)) return { kind: 'self' }
  if (ctx.internalEmails.has(email)) return { kind: 'internal' }
  if (isAutomatedAddress(email)) return { kind: 'automated' }
  const personId = ctx.crmByEmail.get(email)
  if (personId) return { kind: 'crm', personId }
  return { kind: 'unknown' }
}

/** Snippet stored on the activity — first 200 characters, whitespace collapsed. */
export function snippetOf(text: string | null | undefined, limit = 200): string | null {
  if (!text) return null
  const clean = String(text).replace(/\s+/g, ' ').trim()
  if (!clean) return null
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 1)}…`
}

/** Matches your own address, allowing for Gmail's dot and plus aliasing. */
export function isSelf(email: string, ctx: SweepContext): boolean {
  if (ctx.selfEmails.has(email)) return true
  const canon = canonicalGmail(email)
  for (const s of ctx.selfEmails) if (canonicalGmail(s) === canon) return true
  return false
}

/** Outbound when any of your own addresses is a sender. */
export function directionOf(fromEmail: string | null, ctx: SweepContext): 'OUTBOUND' | 'INBOUND' {
  return fromEmail !== null && isSelf(fromEmail, ctx) ? 'OUTBOUND' : 'INBOUND'
}
