import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'
import { StructuredData } from '@/components/StructuredData'

const tab = AUDIENCE_TABS.find((t) => t.id === 'recruiters')!

export const metadata: Metadata = {
  title: 'Source Verified, Opted-In Talent — NextChapter for Recruiters',
  description:
    "A talent pool that wants to be found — including the strong candidates ATS filters bury. Search by how people actually work, without five-figure seat licenses. Join the recruiter waitlist.",
  alternates: { canonical: '/recruiters' },
  openGraph: {
    title: 'Source Verified, Opted-In Talent — NextChapter for Recruiters',
    description:
      "A talent pool that wants to be found — including the strong candidates ATS filters bury. Search by how people actually work, without five-figure seat licenses.",
    url: 'https://launchyournextchapter.com/recruiters',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter for Recruiters',
  serviceType: 'Talent sourcing platform',
  provider: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
  areaServed: 'US',
  audience: { '@type': 'BusinessAudience', audienceType: 'Recruiters' },
  description:
    'A talent pool that wants to be found — including the strong candidates ATS filters bury. Search by how people actually work, without five-figure seat licenses.',
  url: 'https://launchyournextchapter.com/recruiters',
}

export default function RecruitersPage() {
  return (
    <>
      <StructuredData data={jsonLd} />
      <OrganizationPageTemplate tab={tab} />
    </>
  )
}
