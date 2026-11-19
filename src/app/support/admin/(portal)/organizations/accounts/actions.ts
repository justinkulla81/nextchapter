'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

// A school or department's plan (owner decision 2026-11-18): set by NextChapter, like an institution's.
export async function setUnitPlanAction(unitId: string, plan: 'FREE' | 'PAID'): Promise<void> {
  const admin = await requireAdmin()
  const unit = await prisma.institutionUnit.update({ where: { id: unitId }, data: { plan }, select: { institutionId: true } })
  captureServerEvent(admin.email ?? 'admin', 'institution_unit_plan_set', { unitId, institutionId: unit.institutionId, plan })
  revalidatePath('/support/admin/organizations/accounts')
}
