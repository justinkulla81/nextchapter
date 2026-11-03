import { publisherKey } from './news-headline'

/**
 * Outlets whose layoff reports are accurate enough to file on their own.
 * Matched on the publisher name as the feed gives it, ignoring case, a
 * leading "The", and a ".com" ("Bloomberg.com" is "Bloomberg").
 */
const TRUSTED = [
  'reuters', 'associated press', 'ap news', 'bloomberg', 'wall street journal', 'new york times', 'washington post',
  'financial times', 'cnbc', 'cnn', 'bbc', 'npr', 'axios', 'business insider', 'fortune', 'forbes', 'techcrunch',
  'the verge', 'wired', 'geekwire', 'yahoo finance', 'marketwatch', 'barron', 'fierce', 'hr dive', 'sec.gov',
]

function normal(publisher: string | null | undefined): string {
  return publisherKey(publisher).replace(/^the /, '').replace(/\.com$/, '')
}

export function isTrustedPublisher(publisher: string | null | undefined): boolean {
  const p = normal(publisher)
  return !!p && TRUSTED.some((t) => p === t || p.startsWith(`${t} `) || p.includes(t))
}

/**
 * Whether a layoff only one publisher has reported is still worth filing,
 * unconfirmed, for a person to review. Two publishers confirm a layoff; one
 * headline can be wrong, so a lone report counts only when it comes from an
 * outlet on the trusted list, or is about an organization already in the CRM,
 * where a wrong guess costs a dismissed row and a right one is a warm lead's
 * employer.
 */
export function singleSourceQualifies(publisher: string | null | undefined, employerInCrm: boolean): boolean {
  return employerInCrm || isTrustedPublisher(publisher)
}

const THOUSANDS = /\b(?:several |many |tens of )?thousands? (?:of )?(?:jobs|employees|workers|staff|roles|positions|people)\b|\b(?:lay(?:s|ing)? off|cuts?|cutting|layoffs? (?:of|affecting|hitting)) (?:several |many )?thousands\b/i

/**
 * A state filing covers one site or one division; a company-wide announcement can be far larger. When the story
 * reports at least 1,000 jobs and five times the filing (or says "thousands" and the filing is under 1,000), it is
 * a different event, not a second report of the filing: it gets its own entry. Headcount-less stories qualify
 * only on the words, and a filing of 1,000+ jobs is assumed to be the same layoff.
 */
export function newsOutgrowsFiling(filingEmployees: number | null, newsEmployees: number | null, headlines: string[]): boolean {
  if (newsEmployees != null) return newsEmployees >= 1000 && newsEmployees >= (filingEmployees ?? 0) * 5
  if ((filingEmployees ?? 0) >= 1000) return false
  return headlines.some((h) => THOUSANDS.test(h))
}
