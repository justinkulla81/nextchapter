// URL slugs for public employer pages (/employers/<slug>). Pure, so the rules are unit-tested.
//
// A company's canonicalNameNormalized is unique. When it is plain words and digits the slug is just those words
// joined by hyphens ("american-express"), and the page resolves by reversing that. Any other name ("at&t") gets
// its readable form plus the last six characters of its id, so two names that read alike never share a URL.

const PLAIN = /^[a-z0-9]+( [a-z0-9]+)*$/

export function readable(s: string): string {
  return s.toLowerCase().replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export function employerSlug(canonicalNameNormalized: string, id: string): string {
  if (PLAIN.test(canonicalNameNormalized)) return canonicalNameNormalized.replace(/ /g, '-')
  return `${readable(canonicalNameNormalized) || 'employer'}-${id.slice(-6).toLowerCase()}`
}

/** The canonical name a plain slug stands for. */
export function canonicalFromEmployerSlug(slug: string): string {
  return slug.replace(/-/g, ' ')
}

/** The id suffix on a non-plain slug, or null. */
export function idSuffixFromSlug(slug: string): string | null {
  const m = /-([a-z0-9]{6})$/.exec(slug)
  return m ? m[1] : null
}
