import { getCurrentCoach } from '@/lib/coach/current-coach'
import { getCoachCaseload } from '@/lib/coach/caseload'
import { csvResponse, datedName } from '@/lib/partners/csv-response'
import { recordPartnerAudit } from '@/lib/partners/audit'

// The coach's own client list: what the coach already sees on the caseload page.
export async function GET() {
  const coach = await getCurrentCoach()
  const caseload = await getCoachCaseload(coach.id)
  await recordPartnerAudit({ portal: 'COACH', refId: coach.id, actorUserId: coach.userId, actorLabel: coach.workEmail, action: 'export.clients', detail: { rows: caseload.length } })
  return csvResponse(
    datedName('clients'),
    caseload.map((c) => ({
      client: c.name,
      week_in_search: c.weekNumber,
      last_active: c.lastActiveAt,
      needs_attention: c.isStalled || c.triggers.some((t) => t.type === 'RISK') ? 'yes' : 'no',
      points_this_week: c.activityThisWeekPoints,
      points_last_week: c.activityLastWeekPoints,
      mood: c.sentimentLabel,
    })),
    'No clients yet.',
  )
}
