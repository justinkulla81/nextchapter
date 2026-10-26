import { CAREERS_POSTED, type CareerRole } from '@/lib/careers/roles'
import { roleDescriptionText } from '@/lib/careers/role-description'

const SITE_URL = 'https://launchyournextchapter.com'

const EMPLOYMENT_TYPE: Record<CareerRole['employment'], string | null> = {
  'Full-time': 'FULL_TIME',
  Internship: 'INTERN',
  'Associate program': 'FULL_TIME',
  Platform: null,
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The plain-text description as the HTML Google for Jobs and job boards expect: headings become bold lines, dashes become list items. */
export function careerDescriptionHtml(role: CareerRole): string {
  const blocks = roleDescriptionText(role).split('\n\n')
  return blocks
    .map((block) => {
      const lines = block.split('\n')
      const items = lines.filter((l) => l.startsWith('- ')).map((l) => `<li>${escapeHtml(l.slice(2))}</li>`)
      const text = lines.filter((l) => !l.startsWith('- ')).map(escapeHtml).join('<br>')
      return `${text ? `<p>${text}</p>` : ''}${items.length ? `<ul>${items.join('')}</ul>` : ''}`
    })
    .join('')
}

/**
 * schema.org JobPosting for Google for Jobs and the boards that read it. Null for platform roles
 * (coach, recruiter), which are not jobs. Only values we hold: no pay is listed because none is
 * published, and a field we don't know is left out, never guessed.
 */
export function careerJobPostingJsonLd(role: CareerRole): Record<string, unknown> | null {
  const employmentType = EMPLOYMENT_TYPE[role.employment]
  if (role.kind === 'platform' || !employmentType) return null
  return {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: role.title,
    description: careerDescriptionHtml(role),
    datePosted: CAREERS_POSTED,
    employmentType,
    hiringOrganization: {
      '@type': 'Organization',
      name: 'NextChapter',
      sameAs: SITE_URL,
    },
    identifier: { '@type': 'PropertyValue', name: 'NextChapter', value: role.slug },
    directApply: true,
    url: `${SITE_URL}/careers/${role.slug}`,
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressLocality: 'New York', addressRegion: 'NY', addressCountry: 'US' },
    },
    jobLocationType: 'TELECOMMUTE',
    applicantLocationRequirements: { '@type': 'Country', name: 'USA' },
  }
}
