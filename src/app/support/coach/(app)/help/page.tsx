import type { Metadata } from 'next'
import { getCurrentCoach } from '@/lib/coach/current-coach'
import { PortalHelpCenter } from '@/components/help/PortalHelpCenter'

export const metadata: Metadata = { title: 'Help and feedback' }

export default async function CoachHelpPage({ searchParams }: { searchParams: Promise<{ request?: string; kind?: string }> }) {
  const [coach, sp] = await Promise.all([getCurrentCoach(), searchParams])
  return <PortalHelpCenter audience="COACH" requesterId={coach.id} searchParams={sp} />
}
