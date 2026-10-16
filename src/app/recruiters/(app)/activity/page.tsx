import { getCurrentRecruiter } from '@/lib/recruiter/current-recruiter'
import { listPartnerAudit } from '@/lib/partners/audit'
import { PartnerActivity } from '@/components/partners/PartnerActivity'

export const metadata = { title: 'Downloads and activity' }

export default async function RecruiterActivityPage() {
  const recruiter = await getCurrentRecruiter()
  const events = await listPartnerAudit('RECRUITER', recruiter.recruiterFirmId ?? recruiter.id)
  const firmWide = recruiter.firmRole === 'ADMIN'
  return (
    <PartnerActivity
      downloads={[{ label: firmWide ? 'Firm placements and submissions' : 'Your placements and submissions', href: '/recruiters/export/placements', note: 'Role, company, stage and fee. A candidate’s name is included only where they consented to an introduction.' }]}
      events={events.map((e) => ({ id: e.id, action: e.action, actor: e.actorLabel, at: e.createdAt }))}
    />
  )
}
