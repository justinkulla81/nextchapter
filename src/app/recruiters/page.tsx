import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'
import { StructuredData } from '@/components/StructuredData'
import { SubmissionPacketMockup } from '@/components/marketing/SubmissionPacketMockup'

const tab = AUDIENCE_TABS.find((t) => t.id === 'recruiters')!

export const metadata: Metadata = {
  title: 'Candidates Who Arrive With References Already Done — NextChapter for Recruiters',
  description:
    'Every NextChapter candidate comes with five structured references, two validated assessments, and a Dossier you can put in front of a client under your own brand. Consented candidates only.',
  alternates: { canonical: '/recruiters' },
  openGraph: {
    title: 'Candidates Who Arrive With References Already Done — NextChapter for Recruiters',
    description:
      'Every NextChapter candidate comes with five structured references, two validated assessments, and a Dossier you can put in front of a client under your own brand.',
    url: 'https://launchyournextchapter.com/recruiters',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter for Recruiters',
  serviceType: 'Executive recruiting workspace',
  provider: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
  areaServed: 'US',
  audience: { '@type': 'BusinessAudience', audienceType: 'Recruiters' },
  description:
    'Every NextChapter candidate comes with five structured references, two validated assessments, and a Dossier you can put in front of a client under your own brand.',
  url: 'https://launchyournextchapter.com/recruiters',
}

export default function RecruitersPage() {
  return (
    <>
      <StructuredData data={jsonLd} />
      <OrganizationPageTemplate tab={tab} artifact={<SubmissionPacketMockup />} />
    </>
  )
}
