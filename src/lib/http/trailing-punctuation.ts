// A link copied out of a sentence often keeps the sentence's punctuation ("see launchyournextchapter.com/after-a-layoff."),
// and no route ends in one of these characters, so the address 404s. Returns the address without it, or null when there
// is nothing to strip. A file extension (/feed.xml) never ends in punctuation, so it is never touched.
const TRAILING = /(?:[.,;:!?)\]'"]|%22|%27|%29|%5D)+$/i

export function stripTrailingPunctuation(pathname: string): string | null {
  if (!TRAILING.test(pathname)) return null
  const clean = pathname.replace(TRAILING, '')
  if (clean === pathname || clean === '' || clean === '/') return null
  return clean
}
