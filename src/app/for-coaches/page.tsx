import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'
import { StructuredData } from '@/components/StructuredData'

const tab = AUDIENCE_TABS.find((t) => t.id === 'for-coaches')!

export const metadata: Metadata = {
  title: 'Bring Your Clients Onto NextChapter — For Coaches',
  description:
    'Give your career, life, and executive coaching clients a free Hireability Grade, action plan, and daily accountability between your sessions. Free, set up in under a minute.',
  alternates: { canonical: '/for-coaches' },
  openGraph: {
    title: 'Bring Your Clients Onto NextChapter — For Coaches',
    description:
      'Give your coaching clients a free Hireability Grade, action plan, and daily accountability between your sessions.',
    url: 'https://launchyournextchapter.com/for-coaches',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Service',
  name: 'NextChapter for Coaches',
  serviceType: 'Career coaching companion platform',
  provider: { '@type': 'Organization', name: 'NextChapter', url: 'https://launchyournextchapter.com' },
  areaServed: 'US',
  audience: { '@type': 'Audience', audienceType: 'Career coaches' },
  description:
    'Give your coaching clients a free Hireability Grade, action plan, and daily accountability between your sessions.',
  url: 'https://launchyournextchapter.com/for-coaches',
}

export default function ForCoachesPage() {
  return (
    <>
      <StructuredData data={jsonLd} />
      <OrganizationPageTemplate tab={tab} />
    </>
  )
}
