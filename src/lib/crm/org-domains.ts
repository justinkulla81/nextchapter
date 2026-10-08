import { normalizeOrgName } from '@/lib/text/org-name-match'

/**
 * Finding the email domain of an organization we know only by name.
 *
 * In order: the domain its people's real addresses use; its website; a
 * company-name lookup (Clearbit's free autocomplete — only the company name
 * is sent), accepted only when a returned company's name matches ours and
 * its domain receives mail.
 */

/** HR leaders, by title — a list, not a guess about what a title means. */
const HR_LEADER = /\b(chro|chief (people|human|hr|talent|culture|employee experience)|head of (people|hr|human|talent)|(vp|vice president|svp|evp|avp)\b[^;]{0,40}?\b(people|human resources|hr|talent|total rewards)\b|people officer|human resources (director|officer|lead|leader)|director,? (of )?(people|human resources|hr)\b|(global|senior|sr\.?) director[^,;]*\b(people|human resources|hr)\b)/i

export function isHrLeaderTitle(title: string | null | undefined): boolean {
  return !!title && HR_LEADER.test(title)
}

export interface DomainSuggestion { name: string; domain: string }

/**
 * A lookup result we trust. Its name must be ours, or ours with a suffix
 * ("MasterBrand Cabinets, LLC" for "MasterBrand Cabinets") — never a longer
 * name that merely starts with ours ("Millennium Salon Software" is not
 * "Millennium"). A one-word name is too common to trust on the name alone,
 * so its domain must be that word too (paradigm.com for Paradigm). Among
 * matches, a .com beats a country domain (bnpparibas.com, not .pl).
 */
export function pickLookupMatch(orgName: string, suggestions: DomainSuggestion[]): string | null {
  const ours = normalizeOrgName(orgName)
  if (!ours) return null
  const oneWord = !ours.includes(' ')
  const label = (d: string) => d.toLowerCase().replace(/^www\./, '').split('.')[0].replace(/[^a-z0-9]/g, '')
  const matches = suggestions
    .filter((s) => s.domain)
    .filter((s) => {
      const theirs = normalizeOrgName(s.name)
      if (!theirs || !(theirs === ours || ours.startsWith(`${theirs} `))) return false
      return !oneWord || label(s.domain) === ours.replace(/[^a-z0-9]/g, '')
    })
    .map((s) => s.domain.toLowerCase().replace(/^www\./, ''))
  return matches.find((d) => d.endsWith('.com')) ?? matches[0] ?? null
}

export async function lookupDomain(orgName: string): Promise<string | null> {
  const url = `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(orgName)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
  if (!res?.ok) return null
  const list = (await res.json().catch(() => [])) as DomainSuggestion[]
  return Array.isArray(list) ? pickLookupMatch(orgName, list) : null
}

/** Whether a domain receives email at all (has a mail server). */
export async function receivesMail(domain: string): Promise<boolean> {
  const { resolveMx } = await import('dns/promises')
  try {
    return (await resolveMx(domain)).length > 0
  } catch {
    return false
  }
}
