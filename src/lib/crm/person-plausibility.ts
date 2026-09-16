import { isAutomatedAddress } from './sync-matching'

/**
 * Words that show up as a display name when the sender is an organization,
 * mailing list, or venue rather than a person — "1636 Forum", "Acquiring
 * Minds Webinar", "826NYC Corp". Checked as whole words so a real surname
 * that happens to contain one of these as a substring isn't caught.
 */
const ORG_NAME_WORDS =
  /\b(forum|webinar|webinars|workshop|conference|summit|alliance|coalition|institute|center|centre|committee|council|group|society|foundation|fund|ventures|capital|partners|consortium|network|association|llc|inc|corp|corporation|team|board|hq|office|street|ave|avenue|blvd|boulevard)\b/i

/** "a. e." or "j.d." — initials with no actual name, usually a garbled parse rather than a real short name. */
const INITIALS_ONLY = /^[a-z]\.?\s*[a-z]\.?$/i

/**
 * A name is worth flagging for review when it STARTS with a digit (a street
 * address or venue — "826NYC", "1636 Forum", "321 W 78th Street" — real
 * human names essentially never do), matches a known organizational/venue
 * word, or is bare initials with nothing else. Deliberately a leading digit,
 * not a digit anywhere: a person with no real display name on file gets a
 * fallback name straight from their email's local part (see
 * getOrCreatePerson), and a trailing number there ("omerutah14") is an
 * ordinary username suffix, not evidence the record isn't a person. None of
 * these are proof by themselves — this stays a review flag, not an
 * auto-delete rule — but together they catch the recurring shape of
 * non-person rows a sweep or import can produce.
 */
export function looksLikeOrgOrSpamName(fullName: string): boolean {
  const name = fullName.trim()
  if (!name) return false
  if (/^\d/.test(name)) return true
  if (ORG_NAME_WORDS.test(name)) return true
  if (INITIALS_ONLY.test(name)) return true
  return false
}

/** a-z0-9 only, for comparing a name against a domain regardless of spacing or punctuation. */
function alphanumeric(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * The display name IS the company's own brand — "American Express" arriving
 * from americanexpress.com, "Amazon.com" from amazon.com. A real person's
 * name coinciding with their employer's domain this closely essentially
 * never happens by chance, so this needs no other corroborating signal.
 */
function nameMatchesDomain(fullName: string, email: string): boolean {
  const domain = email.split('@')[1]
  if (!domain) return false
  const domainRoot = alphanumeric(domain.split('.')[0])
  const name = alphanumeric(fullName)
  return domainRoot.length >= 4 && name.length >= 4 && (name.includes(domainRoot) || domainRoot.includes(name))
}

/** Combines the name-shape check with the email-address check already used to decide what a sweep should even log. */
export function looksLikeNotAPerson(fullName: string, email: string | null): boolean {
  if (looksLikeOrgOrSpamName(fullName)) return true
  if (email && isAutomatedAddress(email)) return true
  if (email && nameMatchesDomain(fullName, email)) return true
  return false
}
