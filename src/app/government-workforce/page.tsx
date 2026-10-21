import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'
import { StructuredData } from '@/components/StructuredData'
import { WorkforceCapabilities, WorkforceNumbers } from '@/components/organizations/WorkforceNumbers'

// The live numbers are cached for a day (src/lib/marketing/workforce-numbers.ts); rebuild hourly.
export const revalidate = 3600

const tab = AUDIENCE_TABS.find((t) => t.id === 'government')!

export const metadata: Metadata = {
  title: 'Workforce & WIOA Partnerships for Agencies',
  description:
    'NextChapter, the leading job transition platform, helps the people you serve get back to work faster — free to every jobseeker, with exportable participant progress and self-reported placement counts, and AI training for career services. Built to sit alongside WIOA systems of record. Join the waitlist.',
  alternates: { canonical: '/government-workforce' },
  openGraph: {
    title: 'Workforce & WIOA Partnerships — NextChapter for Agencies',
    description:
      'Help the people you serve get back to work faster — free to every jobseeker, with exportable participant progress and self-reported placement counts.',
    url: 'https://launchyournextchapter.com/government-workforce',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter for Workforce Agencies',
  serviceType: 'Workforce development partnership',
  provider: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
  areaServed: 'US',
  audience: { '@type': 'Audience', audienceType: 'Government and workforce agencies' },
  description:
    'Help the people you serve get back to work faster — free to every jobseeker, with exportable participant progress and self-reported placement counts. Built to sit alongside WIOA systems of record.',
  url: 'https://launchyournextchapter.com/government-workforce',
}

export default function GovernmentWorkforcePage() {
  return (
    <>
      <StructuredData data={jsonLd} />
      <OrganizationPageTemplate
        tab={tab}
        lead={<WorkforceNumbers page={tab.id} />}
        whatYouGet={<WorkforceCapabilities page={tab.id} />}
      />
    </>
  )
}
