'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'

const CRM = '/support/admin/crm'
const STATUSES = ['ACTIVE', 'ON_HOLD', 'CLOSED'] as const
type MandateStatus = (typeof STATUSES)[number]

export type MandateResult = { ok: true } | { ok: false; error: string }

function refresh(recruiterId: string, orgId: string) {
  revalidatePath(`${CRM}/people/${recruiterId}`)
  revalidatePath(`${CRM}/organizations/${orgId}`)
  revalidatePath(`${CRM}/mandates`)
}

/** Adds a mandate from the recruiter's record. The company must already be in the CRM. */
export async function addMandate(recruiterId: string, input: { company: string; scope: string; status: string }): Promise<MandateResult> {
  const admin = await requireAdmin()
  const company = input.company.trim()
  if (!company) return { ok: false, error: 'Enter the company this recruiter has a mandate with.' }
  if (!(STATUSES as readonly string[]).includes(input.status)) return { ok: false, error: 'Choose Active, On hold or Closed.' }
  const org = await prisma.crmOrganization.findUnique({
    where: { canonicalNameNormalized: normalizeOrgName(company) },
    select: { id: true, name: true },
  })
  if (!org) return { ok: false, error: `No company named "${company}" is in the CRM. Add it under Organizations first, then try again.` }
  const scope = input.scope.trim() || null
  const status = input.status as MandateStatus
  const mandate = await prisma.crmMandate.create({
    data: { recruiterId, orgId: org.id, scope, status, startedAt: new Date(), endedAt: status === 'CLOSED' ? new Date() : null },
  })
  captureServerEvent(admin.email ?? 'admin', 'mandate_added', { mandateId: mandate.id, recruiterId, orgId: org.id, status, hasScope: Boolean(scope) })
  refresh(recruiterId, org.id)
  return { ok: true }
}

export async function setMandateStatus(mandateId: string, status: string): Promise<MandateResult> {
  const admin = await requireAdmin()
  if (!(STATUSES as readonly string[]).includes(status)) return { ok: false, error: 'Choose Active, On hold or Closed.' }
  const m = await prisma.crmMandate.findUnique({ where: { id: mandateId }, select: { recruiterId: true, orgId: true, status: true } })
  if (!m) return { ok: false, error: 'This mandate no longer exists. Reload the page.' }
  await prisma.crmMandate.update({
    where: { id: mandateId },
    data: { status: status as MandateStatus, endedAt: status === 'CLOSED' ? new Date() : null },
  })
  captureServerEvent(admin.email ?? 'admin', 'mandate_status_changed', {
    mandateId, recruiterId: m.recruiterId, orgId: m.orgId, from: m.status, to: status,
  })
  refresh(m.recruiterId, m.orgId)
  return { ok: true }
}

export async function removeMandate(mandateId: string): Promise<MandateResult> {
  const admin = await requireAdmin()
  const m = await prisma.crmMandate.findUnique({ where: { id: mandateId }, select: { recruiterId: true, orgId: true } })
  if (!m) return { ok: true }
  await prisma.crmMandate.delete({ where: { id: mandateId } })
  captureServerEvent(admin.email ?? 'admin', 'mandate_removed', { mandateId, recruiterId: m.recruiterId, orgId: m.orgId })
  refresh(m.recruiterId, m.orgId)
  return { ok: true }
}
