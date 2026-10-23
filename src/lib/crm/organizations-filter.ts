import 'server-only'
import type { Prisma, CrmOrgType, CrmGoal } from '@prisma/client'
import { hasLearningDevHead, missingLearningDevHead } from '@/lib/crm/learning-dev'
import { hasChro, missingChro } from '@/lib/crm/chro'
import { isOrgRelationshipFilter, relationshipWhere } from '@/lib/crm/org-relationships'
import { orgIdsWithLayoffs } from '@/lib/crm/org-layoffs'
import { orgIdsWithCommunication } from '@/lib/crm/org-communication'
import { isDealStatus } from '@/lib/crm/deal-status'

export type OrganizationsFilterParams = Record<string, string | undefined>

/**
 * The Organizations list's filters as a Prisma where. Shared by the page and its CSV
 * export so the export is always exactly the rows on screen, whatever the page size.
 */
export async function organizationsWhere(sp: OrganizationsFilterParams): Promise<Prisma.CrmOrganizationWhereInput> {
  const q = (sp.q ?? '').trim()
  const type = sp.type ?? ''
  const rel = isOrgRelationshipFilter(sp.rel) ? sp.rel : ''
  const goal = sp.goal ?? ''
  const deal = sp.deal ?? ''
  const layoffs = sp.layoffs === 'any' ? 'any' : ''
  const comm = sp.comm === 'any' || sp.comm === 'none' || sp.comm === 'waiting' ? sp.comm : ''
  const ldHead = sp.ldhead === 'missing' || sp.ldhead === 'has' ? sp.ldhead : ''
  const chro = sp.chro === 'missing' || sp.chro === 'has' ? sp.chro : ''

  const layoffOrgIds = layoffs ? await orgIdsWithLayoffs() : null
  const commOrgIds = comm ? await orgIdsWithCommunication(comm === 'waiting') : null
  return {
    ...(commOrgIds ? { AND: [{ id: comm === 'none' ? { notIn: commOrgIds } : { in: commOrgIds } }] } : {}),
    ...(layoffOrgIds ? { id: { in: layoffOrgIds } } : {}),
    ...(rel ? { AND: [...(commOrgIds ? [{ id: comm === 'none' ? { notIn: commOrgIds } : { in: commOrgIds } }] : []), relationshipWhere(rel)] } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
    ...(type ? { orgTypes: { has: type as CrmOrgType } } : {}),
    ...(goal ? { goals: { has: goal as CrmGoal } } : {}),
    ...(ldHead === 'missing' ? missingLearningDevHead : ldHead === 'has' ? hasLearningDevHead : {}),
    ...(chro === 'missing' ? missingChro : chro === 'has' ? hasChro : {}),
    ...(deal === 'any' ? { dealStatus: { not: null } } : deal && isDealStatus(deal) ? { dealStatus: deal } : {}),
  }
}
