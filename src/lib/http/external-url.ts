// An address stored without its scheme ("garfield.utah.gov/departments/planning") is a relative link
// in HTML: on /economic-development/utah/<org> it opens /economic-development/utah/garfield.utah.gov/...
// and 404s. Everything we show as an outside link goes through here so that cannot happen.

const HOSTLIKE = /^(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+(?::\d+)?(?:[/?#]|$)/i
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** True for an address that points inside this site or is a non-web link (path, anchor, mailto:, tel:). */
export function isInternalOrSpecial(href: string): boolean {
  return href.startsWith('/') || href.startsWith('#') || href.startsWith('?') || /^(mailto|tel|sms):/i.test(href)
}

/**
 * An absolute https URL for an outside address, or null when it is not one. "example.org/page" becomes
 * "https://example.org/page"; "//example.org" becomes "https://example.org"; paths and junk return null.
 */
export function absoluteWebUrl(value: string | null | undefined): string | null {
  const v = (value ?? '').trim()
  if (!v || /\s/.test(v)) return null
  if (/^https?:\/\//i.test(v)) return v
  if (v.startsWith('//')) return HOSTLIKE.test(v.slice(2)) ? `https:${v}` : null
  if (isInternalOrSpecial(v) || HAS_SCHEME.test(v)) return null
  return HOSTLIKE.test(v) ? `https://${v}` : null
}
