import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'

const tab = AUDIENCE_TABS.find((t) => t.id === 'nonprofits')!

export const metadata: Metadata = {
  title: 'Partnerships, Funding & Research — NextChapter for Nonprofits & Academia',
  description:
    'Serve your community at no cost to them, and partner on consent-based research into what actually gets people back to work. Grants, pilots, and co-design. Join the waitlist.',
  alternates: { canonical: '/nonprofits' },
  openGraph: {
    title: 'Partnerships, Funding & Research — NextChapter for Nonprofits & Academia',
    description:
      'Serve your community at no cost to them, and partner on consent-based research into what actually gets people back to work.',
    url: 'https://launchyournextchapter.com/nonprofits',
  },
}

export default function NonprofitsPage() {
  return <OrganizationPageTemplate tab={tab} />
}
