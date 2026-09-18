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
  'ealerts', 'welcome', 'membership', 'members', 'service', 'services', 'pharmacy',
  'acquisitions', 'quest',
])

// Long, distinctive words that a real person's local-part essentially never
// contains even glued to something else with no separator at all —
// "nasmmembership@", "nypfeedback@" — so these check for the substring
// anywhere, the same way "notification"/"no-reply" already do below, rather
// than requiring a punctuation-delimited word like hasWord does.
const BULK_SUBSTRING = /membership|feedback|college/i

// order-update@, shipment-tracking@, marketplace-messages@ — transactional
// commerce mail from a real company's own domain, not a person there.
const TRANSACTIONAL_LOCAL = /^(order|orders|shipment|shipping|tracking|delivery|invoice|receipt|statement|marketplace|payment|payments|billing|subscription|renewal|store)([-_+].*)?$/i

/** Domains that never contain a business contact worth tracking. */
const AUTOMATED_DOMAIN = /(^|\.)(mailchimp|sendgrid|mailgun|substack|intercom|zendesk|calendly|docusign|stripe|slack|atlassian|notion|linear|github|google|apple|amazonses|postmarkapp|hubspot|salesforce|zoom|workday|myworkday|icims|beehiiv|shopifyemail|klaviyomail|mailerlite|constantcontact|campaign-archive|sparkpostmail|mandrillapp|eventbrite|ccsend|icontact|aweber|getresponse|activecampaign|klaviyo|sailthru|braze|iterable|marketo|pardot|exacttarget|cheetahmail|bronto|listrak|dotdigital|campaignmonitor|mailjet|luma-mail|medallia|surveymonkey|qualtrics)\.(com|net|io|org)$/i

// Individually chasing exact local-parts and domains (mailer@,
// feedback-marriott.com, manhattansoccerclub.mailer@leagueapps.com) is an
// endless tail — every real company invents its own compound. This instead
// splits on the punctuation senders actually use to glue words together
// (. _ -) and checks each resulting word on its own, so "feedback-marriott"
// is really just "feedback" + "marriott", and "manhattansoccerclub.mailer"
// is really "manhattansoccerclub" + "mailer".
//
// Two lists, not one — a domain choosing a bulk/notification word as one of
// its own labels is a strong, essentially risk-free signal (a real
// company's or person's domain is their name, not generic infrastructure
// vocabulary). A LOCAL part is nearly as safe to split the same way EXCEPT
// for the couple of words short or generic enough that a real person picks
// them for themselves: a middle initial ("alex.e.bryson") or a self-chosen
// prefix ("info.mrinalpandey") on their own personal address. Those two
// ("e", "info") are excluded from the local list; everything else here
// (mail@, email@, leadership-news@, etc.) is a generic mailbox essentially
// no one would choose as their own compound.
const BULK_DOMAIN_WORD = /^(mail|mailer|email|e|news|update|updates|welcome|notify|notifications?|marketing|campaigns?|newsletters?|lists?|comms?|communications?|info|send|sending|alerts?|ealerts|feedback|survey|surveys|reviews?)$/i
const BULK_LOCAL_WORD = /^(mail|mailer|email|news|update|updates|welcome|notify|notifications?|marketing|campaigns?|newsletters?|lists?|comms?|communications?|send|sending|alerts?|ealerts|feedback|survey|surveys|reviews?)$/i

function hasWord(value: string, pattern: RegExp): boolean {
  return value.split(/[._-]/).some((word) => pattern.test(word))
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null
  // "Jane Doe <jane@x.com>" and bare addresses both arrive here.
  const m = String(raw).match(/<([^>]+)>/)
  const addr = (m ? m[1] : String(raw)).trim().toLowerCase()
  // Something before the @, a dotted domain after it, no spaces. "Contains
  // an @" let "@kindcap.com" onto a record as an address.
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return null
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
  if (BULK_SUBSTRING.test(local)) return true
  if (/^[0-9a-f]{16,}$/.test(local)) return true
  if (AUTOMATED_DOMAIN.test(domain)) return true
  // manhattansoccerclub.mailer@leagueapps.com, marriott-bonvoy@feedback-
  // marriott.com, reviews@okendo.io — checked as words, not the whole
  // string, since a real sender glues its own name onto these.
  if (hasWord(local, BULK_LOCAL_WORD)) return true
  if (hasWord(domain.split('.').slice(0, -1).join('.'), BULK_DOMAIN_WORD)) return true
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
  // crmByEmail is keyed by canonical mailbox — see buildSweepContext.
  const personId = ctx.crmByEmail.get(canonicalGmail(email))
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

/**
 * Whether a message is plausibly about NextChapter, from what a metadata
 * fetch already gives you — subject and Gmail's own snippet — never a full
 * body fetch just to answer this. A reply keeps its parent's subject by
 * default, so a thread that started "NextChapter" stays matched without
 * re-reading each reply.
 *
 * Deliberately loose: "next chapter" (spaced), any case, or the bare domain
 * in a signature link. False positives (an unrelated email that happens to
 * say "next chapter of my career") cost nothing — an inbound one is
 * relevant and logged, an outbound one needed no review anyway. False
 * negatives are the real cost, which is why the check is this generous.
 */
export function mentionsNextChapter(subject: string | null | undefined, snippet: string | null | undefined): boolean {
  const text = `${subject ?? ''} ${snippet ?? ''}`.toLowerCase()
  return /next\s*chapter/.test(text) || text.includes('launchyournextchapter')
}
