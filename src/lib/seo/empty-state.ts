import { notFound, redirect } from 'next/navigation'
import { stateFromSlug } from '@/lib/seo/states'

/**
 * A state page built only when the state has data (a recent layoff notice, a workforce board, a college) is a dead end
 * for a state that has none. A real state slug goes to the section's hub instead of a 404, so a crawler or a visitor
 * who follows an old or cached link lands somewhere useful; a slug that is not a state is still a 404. The redirect is
 * temporary (307) because the page comes back when the data does.
 */
export function emptyStateOrNotFound(slug: string, hubPath: string): never {
  if (stateFromSlug(slug)) redirect(hubPath)
  notFound()
}
