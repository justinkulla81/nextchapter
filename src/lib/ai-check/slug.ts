// URL slugs for the AI job check: "software-developers-15-1252". The 6-digit SOC code on the end is the key, so a renamed
// title never breaks a shared link; the words in front are only for people and search engines.

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export function checkSlug(title: string, soc6: string): string {
  return `${slugify(title)}-${soc6}`
}

/** The 6-digit SOC code on the end of a slug, or null when the slug does not end in one. */
export function socFromSlug(slug: string): string | null {
  const m = /-(\d{2}-\d{4})$/.exec(slug)
  return m ? m[1] : null
}

export const checkPath = (title: string, soc6: string): string => `/tools/ai-job-check/${checkSlug(title, soc6)}`
