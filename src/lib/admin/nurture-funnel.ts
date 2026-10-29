import { prisma } from '@/lib/prisma'
import { NURTURE_REF_PREFIX, NURTURE_STEPS, nurtureEmailsOn, type NurtureStep } from '@/lib/leads/nurture/config'

// The follow-up sequence on the admin funnel page: per step, how many went out in the window, how many were opened and
// clicked (the CRM outreach tracking the lifecycle emails use), and how many recipients have since registered. Read
// only. Opens are a rough signal (mail providers prefetch images); clicks and registrations are the real ones.

export interface NurtureStepRow {
  step: NurtureStep
  label: string
  sent: number
  opened: number
  clicked: number
}

export interface NurtureFunnelData {
  /** Whether sending is on (NURTURE_EMAILS=1). */
  on: boolean
  steps: NurtureStepRow[]
  /** People who got a sequence email in the window and have since registered. */
  registeredAfter: number
  recipients: number
}

const LABEL: Record<NurtureStep, string> = { next_step: 'Day 3: the next step', data_point: 'Day 7: one number', assessment: 'Day 14: the assessment' }

export async function computeNurtureFunnel(windowDays: number): Promise<NurtureFunnelData> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
  const rows = await prisma.crmActivity.findMany({
    where: { type: 'EMAIL', sourceRef: { startsWith: NURTURE_REF_PREFIX }, createdAt: { gte: since } },
    select: {
      sourceRef: true,
      person: { select: { candidateId: true } },
      outreachTracking: { select: { openedAt: true, links: { select: { clickCount: true } } } },
    },
    take: 20000,
  })

  const steps: NurtureStepRow[] = NURTURE_STEPS.map((step) => ({ step, label: LABEL[step], sent: 0, opened: 0, clicked: 0 }))
  const people = new Map<string, boolean>()
  for (const r of rows) {
    const [, stepName, email] = (r.sourceRef ?? '').split(':')
    const row = steps.find((s) => s.step === stepName)
    if (!row) continue
    row.sent++
    if (r.outreachTracking?.openedAt) row.opened++
    if (r.outreachTracking?.links.some((l) => l.clickCount > 0)) row.clicked++
    if (email) people.set(email, (people.get(email) ?? false) || !!r.person?.candidateId)
  }
  return { on: nurtureEmailsOn(), steps, registeredAfter: [...people.values()].filter(Boolean).length, recipients: people.size }
}
