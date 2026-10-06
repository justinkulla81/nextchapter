// Builders for the schema.org objects shared across public pages. Each returns
// a plain object for <StructuredData data={...} />.

import { type Author, DEFAULT_AUTHOR, authorId, authorPath } from './authors'
import { FACTS, ORGANIZATION_ID, SITE_URL } from './facts'

const abs = (path: string) => (path.startsWith('http') ? path : `${SITE_URL}${path}`)

/** The site's default share image, used when a page has none of its own. */
export const DEFAULT_IMAGE = `${SITE_URL}/opengraph-image`

/** A reference to the Organization; the full node is on the homepage and /about. */
export function organizationRef() {
  return { '@type': 'Organization', '@id': ORGANIZATION_ID, name: FACTS.name, url: SITE_URL, logo: FACTS.logo }
}

/** The full Person node, for the author's own page. */
export function personJsonLd(a: Author = DEFAULT_AUTHOR) {
  return {
    '@type': 'Person',
    '@id': authorId(a),
    name: a.name,
    jobTitle: a.jobTitle,
    url: abs(authorPath(a)),
    ...(a.image ? { image: abs(a.image) } : {}),
    sameAs: [a.linkedIn],
    worksFor: organizationRef(),
    alumniOf: a.alumniOf.map((name) => ({ '@type': 'CollegeOrUniversity', name })),
  }
}

/** A short Person reference, for an article's author. */
export function personRef(a: Author = DEFAULT_AUTHOR) {
  return { '@type': 'Person', '@id': authorId(a), name: a.name, url: abs(authorPath(a)), sameAs: [a.linkedIn] }
}

export function articleJsonLd(opts: {
  headline: string
  path: string
  description?: string
  datePublished?: string
  dateModified: string
  image?: string
  author?: Author
  type?: 'Article' | 'NewsArticle' | 'Report'
}) {
  return {
    '@context': 'https://schema.org',
    '@type': opts.type ?? 'Article',
    headline: opts.headline.slice(0, 110),
    ...(opts.description ? { description: opts.description } : {}),
    author: personRef(opts.author),
    publisher: organizationRef(),
    datePublished: opts.datePublished ?? opts.dateModified,
    dateModified: opts.dateModified,
    image: abs(opts.image ?? DEFAULT_IMAGE),
    mainEntityOfPage: abs(opts.path),
  }
}

/** Trail from Home down to the current page, e.g. [{ name: 'Resources', path: '/resources' }, ...]. */
export function breadcrumbJsonLd(trail: { name: string; path: string }[]) {
  const items = [{ name: 'Home', path: '/' }, ...trail]
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.path === '/' ? SITE_URL : abs(it.path),
    })),
  }
}
