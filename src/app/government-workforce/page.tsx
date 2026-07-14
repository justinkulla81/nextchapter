import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'

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

export default function GovernmentWorkforcePage() {
  return <OrganizationPageTemplate tab={tab} />
}
