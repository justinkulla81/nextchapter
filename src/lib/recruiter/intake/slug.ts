// Slugs and forwarding addresses for NextChapter Talent. Pure.
//
// Firm page:      /in/<firmSlug>             forwarding: <firmSlug>@<domain>
// Personal page:  /in/<firmSlug>/<recSlug>   forwarding: <firmSlug>-<recSlug>@<domain>

const RESERVED_FIRM_SLUGS = new Set(['claim', 'api', 'admin', 'support', 'www', 'mail', 'noreply', 'no-reply'])

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

export function validateSlug(slug: string, { firm }: { firm: boolean }): string | null {
  if (slug.length < 2) return 'Use at least 2 letters or numbers.'
  if (slug.length > 40) return 'Use 40 characters or fewer.'
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return 'Use lowercase letters, numbers and single hyphens.'
  if (firm && RESERVED_FIRM_SLUGS.has(slug)) return 'That address is reserved. Try another.'
  return null
}

export function firmForwardAddress(firmSlug: string, domain: string): string {
  return `${firmSlug}@${domain}`
}

export function recruiterForwardAddress(firmSlug: string, recruiterSlug: string, domain: string): string {
  return `${firmSlug}-${recruiterSlug}@${domain}`
}

export type ForwardTarget = { firmSlug: string; recruiterSlug: string | null }

// Resolves the local part of a forwarding address against the known slugs.
// Firm slugs may themselves contain hyphens, so this tries the exact firm
// slug first, then the longest firm slug that prefixes the local part.
export function resolveForwardLocalPart(
  localPart: string,
  firms: { slug: string; recruiterSlugs: string[] }[]
): ForwardTarget | null {
  const local = localPart.toLowerCase().split('+')[0]
  const exact = firms.find((firm) => firm.slug === local)
  if (exact) return { firmSlug: exact.slug, recruiterSlug: null }

  const candidates = firms
    .filter((firm) => local.startsWith(`${firm.slug}-`))
    .sort((a, b) => b.slug.length - a.slug.length)
  for (const firm of candidates) {
    const rest = local.slice(firm.slug.length + 1)
    if (firm.recruiterSlugs.includes(rest)) return { firmSlug: firm.slug, recruiterSlug: rest }
  }
  return null
}

export function splitAddress(address: string): { local: string; domain: string } | null {
  const match = address.trim().match(/<?([^<>\s@]+)@([^<>\s@]+)>?$/)
  if (!match) return null
  return { local: match[1].toLowerCase(), domain: match[2].toLowerCase() }
}

export function normalizeLinkedinUrl(value: string | null | undefined): string | null {
  if (!value) return null
  const match = value.trim().match(/linkedin\.com\/in\/([^/?#\s]+)/i)
  return match ? `https://www.linkedin.com/in/${match[1].toLowerCase()}` : null
}
