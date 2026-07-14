import type { Metadata } from 'next'
import { OrganizationPageTemplate } from '@/components/organizations/OrganizationPageTemplate'
import { AUDIENCE_TABS } from '@/components/audience/audience-data'

const tab = AUDIENCE_TABS.find((t) => t.id === 'outplacement')!

export const metadata: Metadata = {
  title: 'Outplacement That Relaunches Careers — NextChapter',
  description:
    'Give departing employees a candid diagnostic, a personalized plan, and direct employer matches — not a stale course library. Protect your brand and report real outcomes. Join the waitlist.',
  alternates: { canonical: '/outplacement' },
  openGraph: {
    title: 'Outplacement That Relaunches Careers — NextChapter',
    description:
      'Give departing employees a candid diagnostic, a personalized plan, and direct employer matches — not a stale course library.',
    url: 'https://launchyournextchapter.com/outplacement',
  },
}

export default function OutplacementPage() {
  return <OrganizationPageTemplate tab={tab} />
}
