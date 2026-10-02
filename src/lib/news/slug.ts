/**
 * The address of a News item's own page.
 *
 * Readable words from the headline, then a few characters of the item's id
 * so two items with the same headline never collide and a later headline
 * edit never has to move the page.
 */
export function newsSlug(title: string | null | undefined, fallback: string, id: string): string {
  const words = (title || fallback)
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .split('-').filter(Boolean).slice(0, 10).join('-')
    .slice(0, 70).replace(/-+$/, '')
  return `${words || 'item'}-${id.slice(-6).toLowerCase()}`
}

/** What a card or page calls an item that has no headline of its own. */
export function newsDisplayTitle(item: { title: string | null; kind: string; source: string }): string {
  if (item.title) return item.title
  const what = item.kind === 'linkedin' ? 'LinkedIn post' : item.kind === 'instagram' ? 'Instagram post'
    : item.kind === 'podcast' ? 'Podcast' : item.kind === 'video' ? 'Video' : 'Article'
  return item.source && !/^(linkedin|instagram)$/i.test(item.source) ? `${what} by ${item.source}` : what
}
