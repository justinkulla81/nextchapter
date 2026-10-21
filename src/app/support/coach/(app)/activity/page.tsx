import { getCurrentCoach } from '@/lib/coach/current-coach'
import { listPartnerAudit } from '@/lib/partners/audit'
import { PartnerActivity } from '@/components/partners/PartnerActivity'

export const metadata = { title: 'Downloads and activity' }

export default async function CoachActivityPage() {
  const coach = await getCurrentCoach()
  const events = await listPartnerAudit('COACH', coach.id)
  return (
    <PartnerActivity
      downloads={[{ label: 'Client list', href: '/support/coach/export/clients', note: 'Your clients with week in search, last activity and whether they need attention. Session notes are not included.' }]}
      events={events.map((e) => ({ id: e.id, action: e.action, actor: e.actorLabel, at: e.createdAt }))}
    />
  )
}
