/**
 * Pure matching rules for the Gmail and Calendar sweeps.
 *
 * Kept free of Prisma and network calls so the decisions that matter — whose
 * mail gets logged, whose gets ignored, and what counts as a person at all —
 * are testable without a mailbox.
 */

/** Local-parts that are machinery, not people. */
const AUTOMATED_LOCAL = new Set([
  'no-reply', 'noreply', 'do-not-reply', 'donotreply', 'notifications', 'notification', 'notify',
  'support', 'help', 'info', 'hello', 'contact', 'admin', 'postmaster', 'mailer-daemon',
  'bounce', 'bounces', 'news', 'newsletter', 'updates', 'alerts', 'alert', 'billing',
  'receipts', 'invoice', 'invoices', 'security', 'account', 'accounts', 'team',
  'forum', 'forums', 'webinar', 'webinars', 'events', 'rsvp', 'list', 'lists', 'digest',
  'jobs', 'careers', 'press', 'media', 'sales', 'marketing', 'office', 'hq', 'board',
  'customercare', 'customerservice', 'comms', 'communications', 'onlinebanking',
  'ealerts', 'welcome', 'membership', 'members', 'service', 'services',
])

// order-update@, shipment-tracking@, marketplace-messages@ — transactional
// commerce mail from a real company's own domain, not a person there.
const TRANSACTIONAL_LOCAL = /^(order|orders|shipment|shipping|tracking|delivery|invoice|receipt|statement|marketplace|payment|payments|billing|subscription|renewal|store)([-_+].*)?$/i

/** Domains that never contain a business contact worth tracking. */
const AUTOMATED_DOMAIN = /(^|\.)(mailchimp|sendgrid|mailgun|substack|intercom|zendesk|calendly|docusign|stripe|slack|atlassian|notion|linear|github|google|apple|amazonses|postmarkapp|hubspot|salesforce|zoom|workday|myworkday|beehiiv|shopifyemail|klaviyomail|mailerlite|constantcontact|campaign-archive|sparkpostmail|mandrillapp|eventbrite|ccsend|icontact|aweber|getresponse|activecampaign|klaviyo|sailthru|braze|iterable|marketo|pardot|exacttarget|cheetahmail|bronto|listrak|dotdigital|campaignmonitor|mailjet|luma-mail)\.(com|net|io|org)$/i

// email.aspeninstitute.org, welcome.americanexpress.com, updates.rejigg.com —
// a bulk/notification word as a SUBDOMAIN label (not the registrable domain
// itself) means whatever real company owns the root domain, this particular
// mailbox is still a broadcast/campaign channel. Deliberately scoped to
// subdomain labels only — gmail.com, hotmail.com and similar never have one.
const BULK_SUBDOMAIN_WORD = /^(mail|email|e|news|update|updates|welcome|notify|notifications?|marketing|campaigns?|newsletters?|lists?|comms?|communications?|info|send|sending|alerts?|ealerts)$/i

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

/**
 * The registrable-domain label — the one that actually names the company,
 * ignoring any subdomain in front of it and the TLD after it.
 * "welcome.americanexpress.com" -> "americanexpress", "826nyc.org" -> "826nyc".
 * A 2-label domain has nothing to ignore, so this is just its first label.
 */
export function domainRootLabel(domain: string): string {
  const parts = domain.split('.')
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0]
}

/** True for addresses that are machinery rather than a person. */
export function isAutomatedAddress(email: string): boolean {
  const [local, domain] = email.split('@')
  if (!local || !domain) return true
  if (AUTOMATED_LOCAL.has(local)) return true
  if (TRANSACTIONAL_LOCAL.test(local)) return true
  // reply+<hash>@, bounce-123@, notifications-xyz@, digital-no-reply@,
  // auto-notification@ — "notification" and "no-reply" as a substring
  // anywhere, not just a leading prefix, since real systems compose these
  // local-parts with their own prefix words too.
  if (/^(reply|bounce|mailer)[+._-]/.test(local)) return true
  if (/no.?reply|notifications?/.test(local)) return true
  if (/^[0-9a-f]{16,}$/.test(local)) return true
  if (AUTOMATED_DOMAIN.test(domain)) return true
  const parts = domain.split('.')
  if (parts.slice(0, -2).some((label) => BULK_SUBDOMAIN_WORD.test(label))) return true
  // 826nyc@826nyc.org, americanexpress@welcome.americanexpress.com — the
  // mailbox IS the organization, not a person who happens to work there.
  const domainRoot = domainRootLabel(domain)
  if (domainRoot.length > 2 && local === domainRoot) return true
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
  // An explicit CRM record is a human decision and outranks the blanket
  // candidate/coach/recruiter exclusion below — otherwise adding someone to
  // the CRM on purpose would have no effect for anyone who also happens to
  // hold a product account under the same address.
  const personId = ctx.crmByEmail.get(email)
  if (personId) return { kind: 'crm', personId }
  if (ctx.internalEmails.has(email)) return { kind: 'internal' }
  if (isAutomatedAddress(email)) return { kind: 'automated' }
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
