import { requireOutplacementRole } from '@/lib/employer/outplacement-auth'
import { listPartnerAudit } from '@/lib/partners/audit'
import { PartnerActivity } from '@/components/partners/PartnerActivity'

export const metadata = { title: 'Downloads and activity' }

export default async function EmployerActivityPage() {
  const orgUser = await requireOutplacementRole(['ADMIN', 'VIEWER'])
  const events = await listPartnerAudit('OUTPLACEMENT', orgUser.orgId)
  const downloads = [
    { label: 'Reporting summary', href: '/employer/export/reporting', note: 'Seats, activation and check-ins, with the same small-group rounding and suppression as the Reporting page.' },
    ...(orgUser.role === 'ADMIN' ? [{ label: 'Roster', href: '/employer/export/roster', note: 'The people you enrolled, with status, cohort and dates. Nothing about their search.' }] : []),
  ]
  return <PartnerActivity downloads={downloads} events={events.map((e) => ({ id: e.id, action: e.action, actor: e.actorLabel, at: e.createdAt }))} />
}
