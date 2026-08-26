import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'
import { StructuredData } from '@/components/StructuredData'

const tab = AUDIENCE_TABS.find((t) => t.id === 'talent')!

export const metadata: Metadata = {
  title: 'Hire Verified, Motivated Candidates — NextChapter for Hiring Teams',
  description:
    'Post a role free and see candidates who completed a structured How They Work Best assessment and gathered verified references before you ever see their profile.',
  alternates: { canonical: '/talent' },
  openGraph: {
    title: 'Hire Verified, Motivated Candidates — NextChapter for Hiring Teams',
    description:
      'Post a role free and see candidates who completed a structured assessment and gathered verified references before you ever see their profile.',
    url: 'https://launchyournextchapter.com/talent',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter for Hiring Teams',
  serviceType: 'Direct hiring',
  provider: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
  areaServed: 'US',
  audience: { '@type': 'BusinessAudience', audienceType: 'Employers hiring directly' },
  description: 'Post a role free and see verified, motivated candidates — one flat price, no per-hire tax.',
  url: 'https://launchyournextchapter.com/talent',
}

// Sibling of the auth-gated src/app/talent/(app) route group, which serves
// /talent/dashboard (and the rest of the portal) — not bare /talent — so
// this marketing page and the real app no longer collide on one path.
export default function TalentMarketingPage() {
  return (
    <>
      <StructuredData data={jsonLd} />
      <OrganizationPageTemplate tab={tab} />
    </>
  )
}
