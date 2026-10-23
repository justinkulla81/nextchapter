/**
 * Personal email providers. An address here says nothing about where someone works, so it never proves a claim on an organization.
 * The first block is the list the benefits network has always used; the second adds more common providers for organization claims.
 */
export const CONSUMER_EMAIL_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com', 'live.com', 'msn.com',
])

/** The benefits-network list plus other common personal providers. */
export const CONSUMER_EMAIL_DOMAINS_EXTENDED: ReadonlySet<string> = new Set([
  ...CONSUMER_EMAIL_DOMAINS,
  'googlemail.com', 'ymail.com', 'me.com', 'mac.com', 'pm.me', 'gmx.com', 'gmx.net', 'mail.com', 'yandex.com', 'zoho.com', 'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'bellsouth.net', 'cox.net',
])
