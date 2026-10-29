// The details step of onboarding: a name, an email and (optionally) LinkedIn. Pure and client-safe.
//
// Everyone gives a name before they can make an account. A résumé usually supplies it; when it does not (the visitor
// skipped it, or the reader found no name or email on it) this step asks. Without it the admin pages could only show
// "Candidate" for someone we know nothing about.

export const DETAILS_PATH = '/onboarding/details'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface ContactFields {
  firstName: string | null
  lastName: string | null
  email: string | null
}

/** True when the profile still lacks a name or an email, so the details step has to come next. */
export function needsContactDetails(p: ContactFields): boolean {
  return !p.firstName?.trim() || !p.lastName?.trim() || !p.email?.trim()
}

export interface DetailsInput {
  firstName: string
  lastName: string
  email: string
  linkedInUrl: string
}

export type DetailsCheck =
  | { ok: true; value: { firstName: string; lastName: string; email: string; linkedInUrl: string | null } }
  | { ok: false; message: string }

/** A pasted LinkedIn address, made into a full https URL; null when blank; undefined when it is not a LinkedIn address. */
export function normalizeLinkedInUrl(raw: string): string | null | undefined {
  const text = raw.trim()
  if (!text) return null
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text.replace(/^\/+/, '')}`
  try {
    const url = new URL(withScheme)
    const host = url.hostname.toLowerCase()
    if (host !== 'linkedin.com' && !host.endsWith('.linkedin.com')) return undefined
    return url.toString()
  } catch {
    return undefined
  }
}

export function checkDetails(input: DetailsInput): DetailsCheck {
  const firstName = input.firstName.trim()
  const lastName = input.lastName.trim()
  const email = input.email.trim()
  if (!firstName) return { ok: false, message: 'Enter your first name.' }
  if (!lastName) return { ok: false, message: 'Enter your last name.' }
  if (!EMAIL_PATTERN.test(email)) return { ok: false, message: 'Enter a valid email address. It is where your confirmation link goes.' }
  const linkedInUrl = normalizeLinkedInUrl(input.linkedInUrl)
  if (linkedInUrl === undefined) return { ok: false, message: 'That does not look like a LinkedIn address. Paste your profile link, or leave it blank.' }
  return { ok: true, value: { firstName, lastName, email, linkedInUrl } }
}

/** What the admin pages call a visitor tied to a profile: the name, else the email, else a plain note that nothing is known yet. */
export function adminCandidateLabel(c: { firstName: string | null; lastName: string | null; email?: string | null }): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim()
  return name || c.email?.trim() || 'Candidate (no details yet)'
}
