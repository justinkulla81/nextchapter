import { SITE_URL } from '@/lib/seo/facts'
import { stateName } from '@/lib/seo/states'
import type { AreaJob, OrgPage } from '@/lib/seo/org-pages'

/** schema.org for an organization page: the organization, the places it serves and the roles open there. */
export function orgJsonLd(p: OrgPage, path: string, jobs: AreaJob[]): Record<string, unknown>[] {
  const { row, area, blocks } = p
  const government = row.kind === 'JOB_CENTER' || row.kind === 'WORKFORCE_BOARD' || row.label === 'State economic development agency'
  const served = area.statewide
    ? [{ '@type': 'AdministrativeArea', name: stateName(row.state) }]
    : area.counties.map((c) => ({ '@type': 'AdministrativeArea', name: `${c.name}, ${stateName(row.state)}` }))
  const org: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': government ? 'GovernmentOrganization' : 'Organization',
    '@id': `${SITE_URL}${path}#org`,
    name: row.name,
    url: row.website ?? `${SITE_URL}${path}`,
    mainEntityOfPage: `${SITE_URL}${path}`,
    dateModified: p.lastModified.toISOString(),
    areaServed: served,
    ...(row.street || row.city
      ? { address: { '@type': 'PostalAddress', ...(row.street ? { streetAddress: row.street } : {}), ...(row.city ? { addressLocality: row.city } : {}), addressRegion: row.state, ...(row.zip ? { postalCode: row.zip } : {}), addressCountry: 'US' } }
      : {}),
    ...(row.phone ? { telephone: row.phone } : {}),
    ...(row.hours ? { openingHours: row.hours } : {}),
  }
  const out: Record<string, unknown>[] = [org]
  if (jobs.length > 0) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `Open jobs in the area ${row.name} serves`,
      numberOfItems: blocks.jobsOpen,
      itemListElement: jobs.map((j, i) => ({ '@type': 'ListItem', position: i + 1, name: `${j.title}, ${j.company}`, url: `${SITE_URL}/jobs/${j.id}` })),
    })
  }
  return out
}
