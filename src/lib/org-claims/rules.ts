import { CONSUMER_EMAIL_DOMAINS_EXTENDED } from '@/lib/email/consumer-domains'

export type EmailCheck =
  | { ok: true; email: string; domain: string; needsReview: boolean }
  | { ok: false; reason: 'invalid' | 'consumer' | 'mismatch'; message: string }

const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/

/** A stored domain in its plain form: lower case, no "@", no "www.", no trailing dot. */
export function cleanDomain(d: string | null | undefined): string | null {
  const v = (d ?? '').trim().toLowerCase().replace(/^@/, '').replace(/^www\./, '').replace(/\.$/, '')
  return v.includes('.') ? v : null
}

/** The email's domain is the organization's domain, or a subdomain of it (mail.college.edu for college.edu). */
export function domainMatches(emailDomain: string, orgDomain: string): boolean {
  return emailDomain === orgDomain || emailDomain.endsWith(`.${orgDomain}`)
}

/**
 * Whether this work email can claim this organization.
 * - A personal provider (gmail and the like) never can.
 * - If the organization has a known domain, the email must be at that domain or a subdomain of it.
 * - If the organization has no known domain, any other domain is accepted but the claim needs a person's review.
 */
export function checkClaimEmail(rawEmail: string, orgEmailDomain: string | null | undefined): EmailCheck {
  const email = rawEmail.trim().toLowerCase()
  if (email.length > 254 || email.split('@').length !== 2 || !EMAIL_OK.test(email)) {
    return { ok: false, reason: 'invalid', message: 'Enter a work email, like name@organization.org.' }
  }
  const domain = email.split('@')[1]
  if (CONSUMER_EMAIL_DOMAINS_EXTENDED.has(domain)) {
    return { ok: false, reason: 'consumer', message: 'Use your work email at your organization, not a personal email address.' }
  }
  const orgDomain = cleanDomain(orgEmailDomain)
  if (orgDomain) {
    if (!domainMatches(domain, orgDomain)) {
      return { ok: false, reason: 'mismatch', message: `Use your work email at ${orgDomain}. The address you entered is at ${domain}.` }
    }
    return { ok: true, email, domain, needsReview: false }
  }
  return { ok: true, email, domain, needsReview: true }
}
