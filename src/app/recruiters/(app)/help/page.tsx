import type { Metadata } from 'next'
import { getCurrentRecruiter } from '@/lib/recruiter/current-recruiter'
import { PortalHelpCenter } from '@/components/help/PortalHelpCenter'

export const metadata: Metadata = { title: 'Help and feedback' }

export default async function RecruiterHelpPage({ searchParams }: { searchParams: Promise<{ request?: string; kind?: string }> }) {
  const [recruiter, sp] = await Promise.all([getCurrentRecruiter(), searchParams])
  return <PortalHelpCenter audience="RECRUITER" requesterId={recruiter.id} searchParams={sp} />
}
