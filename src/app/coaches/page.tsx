import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'
import { StructuredData } from '@/components/StructuredData'
import { PreSessionBriefMockup } from '@/components/marketing/PreSessionBriefMockup'

const tab = AUDIENCE_TABS.find((t) => t.id === 'coaches')!

export const metadata: Metadata = {
  title: 'Stop Rebuilding Context Before Every Session — NextChapter for Coaches',
  description:
    "Every client's search, scored and current, with a generated pre-session brief waiting before you dial in. Set up free in under a minute.",
  alternates: { canonical: '/coaches' },
  openGraph: {
    title: 'Stop Rebuilding Context Before Every Session — NextChapter for Coaches',
    description: "Every client's search, scored and current, with a generated pre-session brief waiting before you dial in.",
    url: 'https://launchyournextchapter.com/coaches',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter for Coaches',
  serviceType: 'Career coaching workspace',
  provider: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
  areaServed: 'US',
  audience: { '@type': 'Audience', audienceType: 'Career coaches' },
  description: "Every client's search, scored and current, with a generated pre-session brief waiting before you dial in.",
  url: 'https://launchyournextchapter.com/coaches',
}

export default function CoachesPage() {
  return (
    <>
      <StructuredData data={jsonLd} />
      <OrganizationPageTemplate tab={tab} artifact={<PreSessionBriefMockup />} />
    </>
  )
}
