import type { Metadata } from 'next'
import { getCurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'
import { PortalHelpCenter } from '@/components/help/PortalHelpCenter'

export const metadata: Metadata = { title: 'Help and feedback' }

export default async function EmployerHelpPage({ searchParams }: { searchParams: Promise<{ request?: string; kind?: string }> }) {
  const [orgUser, sp] = await Promise.all([getCurrentOutplacementOrgUser(), searchParams])
  return <PortalHelpCenter audience="EMPLOYER" requesterId={orgUser.id} searchParams={sp} />
}
