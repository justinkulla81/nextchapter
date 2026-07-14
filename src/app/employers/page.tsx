import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'

const tab = AUDIENCE_TABS.find((t) => t.id === 'employers')!

export const metadata: Metadata = {
  title: 'Hire for Fit, Not Keywords — NextChapter for Employers',
  description:
    'See how candidates actually work before the first call — verified profiles and work-style insight, at one flat monthly price with no per-hire fees. Join the employer waitlist.',
  alternates: { canonical: '/employers' },
  openGraph: {
    title: 'Hire for Fit, Not Keywords — NextChapter for Employers',
    description:
      'See how candidates actually work before the first call — verified profiles and work-style insight, at one flat monthly price with no per-hire fees.',
    url: 'https://launchyournextchapter.com/employers',
  },
}

export default function EmployersPage() {
  return <OrganizationPageTemplate tab={tab} />
}
