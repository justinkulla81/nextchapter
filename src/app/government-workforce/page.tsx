import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'
import { StructuredData } from '@/components/StructuredData'

const tab = AUDIENCE_TABS.find((t) => t.id === 'government')!

export const metadata: Metadata = {
  title: 'Workforce & WIOA Partnerships — NextChapter for Agencies',
  description:
    'Help the people you serve get back to work faster — free to every jobseeker, with the placement data your programs report on. Built for WIOA and workforce agencies. Join the waitlist.',
  alternates: { canonical: '/government-workforce' },
  openGraph: {
    title: 'Workforce & WIOA Partnerships — NextChapter for Agencies',
    description:
      'Help the people you serve get back to work faster — free to every jobseeker, with the placement data your programs report on.',
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
    'Help the people you serve get back to work faster — free to every jobseeker, with the placement data your programs report on. Built for WIOA and workforce agencies.',
  url: 'https://launchyournextchapter.com/government-workforce',
}

export default function GovernmentWorkforcePage() {
  return (
    <>
      <StructuredData data={jsonLd} />
      <OrganizationPageTemplate tab={tab} />
    </>
  )
}
