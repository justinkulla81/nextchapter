'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { moveOpportunityStage } from '@/app/support/admin/(portal)/crm/actions'

const ORG_QUEUE = '/support/admin/crm/queue'
const PEOPLE_QUEUE = '/support/admin/crm/queue/people'

/**
 * "Promote" — advances an opportunity to the next stage in its pipeline, by
 * sortOrder. There is no drag-and-drop here (see moveOpportunityStage's own
 * comment on why); this is the queue's one-click version of the same select.
 */
export async function promoteQueueOpportunity(opportunityId: string): Promise<{ message: string }> {
  await requireAdmin()
  const current = await prisma.crmOpportunity.findUniqueOrThrow({
    where: { id: opportunityId },
    select: { stage: { select: { sortOrder: true, pipelineId: true } } },
  })
  const next = await prisma.crmStage.findFirst({
    where: { pipelineId: current.stage.pipelineId, sortOrder: { gt: current.stage.sortOrder } },
    orderBy: { sortOrder: 'asc' },
  })
  if (!next) return { message: 'Already at the last stage.' }
  await moveOpportunityStage(opportunityId, next.id)
  return { message: `Moved to ${next.label}.` }
}

/**
 * "X" an organization out of today's queue. Independent of CrmPerson's own
 * queueSnoozedAt by design — a company you're done chasing for today can
 * still have a person at it worth following up with, and vice versa. Bands
 * resurface a snoozed row once a newer driving date (a fresh promise,
 * deadline, or reminder) appears after this timestamp.
 */
export async function snoozeOrgFromQueue(orgId: string): Promise<void> {
  const admin = await requireAdmin()
  await prisma.crmOrganization.update({ where: { id: orgId }, data: { queueSnoozedAt: new Date() } })
  captureServerEvent(admin.email ?? 'admin', 'crm_org_queue_snoozed', { orgId })
  revalidatePath(ORG_QUEUE)
}

/** Same as snoozeOrgFromQueue, for the people queue. */
export async function snoozePersonFromQueue(personId: string): Promise<void> {
  const admin = await requireAdmin()
  await prisma.crmPerson.update({ where: { id: personId }, data: { queueSnoozedAt: new Date() } })
  captureServerEvent(admin.email ?? 'admin', 'crm_person_queue_snoozed', { personId })
  revalidatePath(PEOPLE_QUEUE)
}
