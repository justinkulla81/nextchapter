/** Extracts the /in/{slug} portion of a LinkedIn profile URL, or null. */
export function slugOf(url: string | undefined | null): string | null {
  if (!url) return null
  const m = url.toLowerCase().match(/linkedin\.com\/in\/([^/?#\s]+)/)
  return m ? m[1].replace(/\/+$/, '') : null
}
