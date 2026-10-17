import { NetworkOverview, type CircleData } from '@/components/network/NetworkOverview'

const CIRCLES: CircleData[] = [
  { key: 'close', name: 'Your close circle', status: 'Alex and Dana are in your corner. No coach yet.', gap: 'A coach reviews your plan and keeps you accountable week to week.', state: 'started', action: { label: 'See how coaching works', href: '#' } },
  { key: 'know', name: 'People you know', status: '184 contacts. 12 are due a follow-up.', state: 'active', action: { label: 'Review follow-ups', href: '#' } },
  { key: 'alumni', name: 'Alumni and groups', status: 'Ohio State alumni and Northwind alumni.', gap: 'Add the schools and past employers you left off to find more people.', state: 'active', action: { label: 'Find alumni at your target companies', href: '#' } },
  { key: 'industry', name: 'Industry and function', status: 'Not joined yet.', gap: 'Communities for finance and operations leaders are open to you.', state: 'empty', action: { label: 'Join a community', href: '#' } },
  { key: 'recruiters', name: 'Recruiters', status: 'Recruiters can find you once you earn Candidate+.', gap: 'You are 62% of the way there.', state: 'locked', action: { label: 'See what is left', href: '#' } },
]

export default function NetworkPreview() {
  return <NetworkOverview headline="Everyone who can help you, from the people closest to you to the wider market. Start with whichever circle needs you most." circles={CIRCLES} />
}
