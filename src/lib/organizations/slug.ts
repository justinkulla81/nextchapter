// URL-safe organization address, used in /p/<slug> and in demo links.
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

/** The first of slug, slug-2, slug-3... that is not taken. */
export function uniqueSlug(base: string, taken: (slug: string) => boolean): string {
  const root = slugify(base) || 'organization'
  if (!taken(root)) return root
  for (let n = 2; n < 1000; n++) {
    const candidate = `${root.slice(0, 36)}-${n}`
    if (!taken(candidate)) return candidate
  }
  return `${root.slice(0, 30)}-${Date.now().toString(36)}`
}
