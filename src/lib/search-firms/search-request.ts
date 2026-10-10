/**
 * Reading and checking a search sent in through /submit-search. Pure, so the
 * rules are tested without a server.
 *
 * Deliberately lighter than the Job Board submission: a confidential search
 * usually has no public posting URL and the client may not want a salary
 * band written down yet, so neither is required. What is required is a real,
 * named person to send the shortlist to.
 */

export const SEARCH_LEVELS = ['Manager', 'Director', 'Vice President', 'C-suite'] as const

export interface SearchRequestInput {
  firmName: string
  contactName: string
  contactEmail: string
  contactPhone: string | null
  roleTitle: string
  clientName: string | null
  confidential: boolean
  level: string | null
  function: string | null
  location: string | null
  compensation: string | null
  description: string | null
  ref: string | null
}

export type SearchRequestValues = Partial<Record<keyof SearchRequestInput, string>>

const GENERIC_INBOX = /^(info|careers?|jobs|hr|recruiting|talent|hello|contact|admin|team|search|office)@/i

const text = (v: FormDataEntryValue | null | undefined, max = 200): string | null => {
  const s = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : ''
  return s ? s.slice(0, max) : null
}

export function readSearchRequest(get: (name: string) => FormDataEntryValue | null): SearchRequestInput {
  const description = typeof get('description') === 'string' ? (get('description') as string).trim().slice(0, 5000) : ''
  const level = text(get('level'))
  return {
    firmName: text(get('firmName')) ?? '',
    contactName: text(get('contactName')) ?? '',
    contactEmail: (text(get('contactEmail')) ?? '').toLowerCase(),
    contactPhone: text(get('contactPhone'), 40),
    roleTitle: text(get('roleTitle')) ?? '',
    clientName: text(get('clientName')),
    confidential: get('confidential') === 'yes',
    level: level && (SEARCH_LEVELS as readonly string[]).includes(level) ? level : null,
    function: text(get('function')),
    location: text(get('location')),
    compensation: text(get('compensation')),
    description: description || null,
    ref: text(get('ref'), 60),
  }
}

/** The first problem, in words a recruiter can act on — or null when it is good to save. */
export function validateSearchRequest(i: SearchRequestInput): string | null {
  if (!i.roleTitle) return 'Enter the role you are hiring for.'
  if (!i.firmName) return 'Enter your firm or company name.'
  if (!i.contactName || !/\S+\s+\S+/.test(i.contactName)) return 'Enter your full name, so we know who to send the shortlist to.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.contactEmail)) return 'Enter a valid email address.'
  if (GENERIC_INBOX.test(i.contactEmail)) return 'Use your own work email, not a shared inbox, so the shortlist reaches the person running the search.'
  return null
}

export function valuesOf(i: SearchRequestInput): SearchRequestValues {
  return {
    firmName: i.firmName, contactName: i.contactName, contactEmail: i.contactEmail, contactPhone: i.contactPhone ?? '',
    roleTitle: i.roleTitle, clientName: i.clientName ?? '', confidential: i.confidential ? 'yes' : 'no',
    level: i.level ?? '', function: i.function ?? '', location: i.location ?? '', compensation: i.compensation ?? '',
    description: i.description ?? '', ref: i.ref ?? '',
  }
}

/** "jane@kbic.com" → "kbic.com", to link the request to a known firm. */
export function emailDomain(email: string): string | null {
  return email.split('@')[1]?.toLowerCase() || null
}
