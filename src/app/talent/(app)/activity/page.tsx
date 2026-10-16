import { getTalentDashboardData } from '@/lib/talent/get-talent-dashboard-data'
import { listPartnerAudit } from '@/lib/partners/audit'
import { PartnerActivity } from '@/components/partners/PartnerActivity'

export const metadata = { title: 'Downloads and activity' }

export default async function TalentActivityPage() {
  const employer = await getTalentDashboardData()
  const events = await listPartnerAudit('HIRING', employer.id)
  return (
    <PartnerActivity
      downloads={[{ label: 'Candidate pipeline', href: '/talent/export/candidates', note: 'Candidates by level and function with the role and stage. Names stay in the portal, where candidates allow them.' }]}
      events={events.map((e) => ({ id: e.id, action: e.action, actor: e.actorLabel, at: e.createdAt }))}
    />
  )
}
