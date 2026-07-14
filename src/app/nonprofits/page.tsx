import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'
import { StructuredData } from '@/components/StructuredData'

const tab = AUDIENCE_TABS.find((t) => t.id === 'nonprofits')!

export const metadata: Metadata = {
  title: 'Partnerships, Funding & Research — NextChapter for Nonprofits & Academia',
  description:
    'Serve your community at no cost to them, and partner on consent-based research into what actually gets people back to work. Grants, pilots, and co-design. Join the waitlist.',
  alternates: { canonical: '/nonprofits' },
  openGraph: {
    title: 'Partnerships, Funding & Research — NextChapter for Nonprofits & Academia',
    description:
      'Serve your community at no cost to them, and partner on consent-based research into what actually gets people back to work.',
    url: 'https://launchyournextchapter.com/nonprofits',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter for Nonprofits & Academia',
  serviceType: 'Nonprofit and research partnership',
  provider: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
  areaServed: 'US',
  audience: { '@type': 'Audience', audienceType: 'Nonprofits and academic researchers' },
  description:
    'Serve your community at no cost to them, and partner on consent-based research into what actually gets people back to work.',
  url: 'https://launchyournextchapter.com/nonprofits',
}

export default function NonprofitsPage() {
  return (
    <>
      <StructuredData data={jsonLd} />
      <OrganizationPageTemplate tab={tab} />
    </>
  )
}
