'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { captureServerEvent } from '@/lib/posthog/server'
import { KIND_LABELS, money, pct } from '@/lib/geo/filters'

/**
 * Moves one lead into the CRM as an organization. If an organization with the
 * same normalized name already exists it is linked, not duplicated or edited.
 */
export async function addLeadToCrm(formData: FormData) {
  const user = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const lead = await prisma.geoOrgLead.findUnique({ where: { id }, include: { geoArea: true } })
  if (!lead || lead.crmOrganizationId) return

  const key = normalizeOrgName(lead.name)
  const existing = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: key }, select: { id: true } })
  const g = lead.geoArea
  const notes = [
    `${KIND_LABELS[lead.kind] ?? lead.kind}. Annual revenue ${money(lead.revenue)} (IRS Form 990${lead.taxPeriod ? `, ${lead.taxPeriod.slice(0, 4)}` : ''}). EIN ${lead.ein}.`,
    g ? `${g.name}, ${g.state}: unemployment ${pct(g.unemploymentRate)}, white-collar est. ${pct(g.wcUnemploymentEst)}, layoffs last 12 months ${g.layoffs12mo.toLocaleString()} workers.` : null,
  ].filter(Boolean).join('\n')

  const orgId =
    existing?.id ??
    (await prisma.crmOrganization.create({
      data: {
        name: lead.name,
        canonicalNameNormalized: key,
        orgTypes: ['NONPROFIT'],
        goals: ['SALES'],
        hqCity: lead.city,
        usState: lead.state,
        website: lead.website,
        industry: KIND_LABELS[lead.kind],
        notes,
      },
      select: { id: true },
    })).id

  await prisma.geoOrgLead.update({ where: { id }, data: { crmOrganizationId: orgId } })
  captureServerEvent(user.email ?? 'admin', 'geo_lead_added_to_crm', { leadId: id, kind: lead.kind, state: lead.state, geoAreaId: lead.geoAreaId, alreadyInCrm: !!existing })
  revalidatePath('/support/admin/crm/economic-development')
}

export async function dismissLead(formData: FormData) {
  const user = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  await prisma.geoOrgLead.update({ where: { id }, data: { dismissedAt: new Date() } })
  captureServerEvent(user.email ?? 'admin', 'geo_lead_dismissed', { leadId: id })
  revalidatePath('/support/admin/crm/economic-development')
}
