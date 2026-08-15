import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'
import { StructuredData } from '@/components/StructuredData'
import { InterviewGuideMockup } from '@/components/marketing/InterviewGuideMockup'

const tab = AUDIENCE_TABS.find((t) => t.id === 'hiring')!

export const metadata: Metadata = {
  title: 'Interview Better, Not Longer — NextChapter for Hiring Managers',
  description:
    'Every candidate submitted to your req arrives with evidence already gathered — a generated interview guide, panel coordination, and structured scorecards.',
  alternates: { canonical: '/hiring' },
  openGraph: {
    title: 'Interview Better, Not Longer — NextChapter for Hiring Managers',
    description: 'Every candidate submitted to your req arrives with evidence already gathered.',
    url: 'https://launchyournextchapter.com/hiring',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter for Hiring',
  serviceType: 'Interview and hiring workspace',
  provider: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
  areaServed: 'US',
  audience: { '@type': 'BusinessAudience', audienceType: 'Hiring managers' },
  description: 'Every candidate submitted to your req arrives with evidence already gathered.',
  url: 'https://launchyournextchapter.com/hiring',
}

// This page lives at src/app/hiring/page.tsx, a sibling of the auth-gated
// src/app/hiring/(app) route group (which now serves /hiring/dashboard,
// not /hiring — see the route-group move in this same build) so the
// marketing page and the real portal no longer collide on one path.
export default function HiringPage() {
  return (
    <>
      <StructuredData data={jsonLd} />
      <OrganizationPageTemplate tab={tab} artifact={<InterviewGuideMockup />} />
    </>
  )
}
