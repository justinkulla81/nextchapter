'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'

const BASE = '/support/admin/school-links'

/**
 * Confirms that a flagged school IS its suggested institution: its education entries
 * and any alumni network move to the target, its name is kept as an alias (so the
 * same spelling resolves next time), and the duplicate is removed.
 */
export async function mergeSchoolIntoSuggestion(formData: FormData): Promise<void> {
  await requireAdmin()
  const sourceId = String(formData.get('sourceId') ?? '')
  if (!sourceId) return

  const source = await prisma.school.findUnique({ where: { id: sourceId } })
  if (!source?.mergeSuggestionId) return
  const target = await prisma.school.findUnique({ where: { id: source.mergeSuggestionId } })
  if (!target || target.id === source.id) return

  // Alumni network, if one was already opened for the duplicate: move its members.
  const [sourceCommunity, targetCommunity] = await Promise.all([
    prisma.community.findUnique({ where: { type_value: { type: 'SCHOOL', value: source.canonicalKey } } }),
    prisma.community.findUnique({ where: { type_value: { type: 'SCHOOL', value: target.canonicalKey } } }),
  ])
  if (sourceCommunity) {
    const dest =
      targetCommunity ??
      (await prisma.community.create({ data: { type: 'SCHOOL', value: target.canonicalKey, label: `${target.name} alumni` } }))
    const members = await prisma.communityMembership.findMany({ where: { communityId: sourceCommunity.id } })
    for (const m of members) {
      await prisma.communityMembership.upsert({
        where: { communityId_candidateId: { communityId: dest.id, candidateId: m.candidateId } },
        create: { communityId: dest.id, candidateId: m.candidateId, joinedVia: m.joinedVia, notifiedAt: m.notifiedAt, leftAt: m.leftAt },
        update: {},
      })
    }
    await prisma.community.delete({ where: { id: sourceCommunity.id } })
  }

  await prisma.educationEntry.updateMany({ where: { schoolId: source.id }, data: { schoolId: target.id } })
  await prisma.school.update({
    where: { id: target.id },
    data: { aliases: [...new Set([...target.aliases, source.name, ...source.aliases])] },
  })
  await prisma.school.delete({ where: { id: source.id } })
  revalidatePath(BASE)
}

/** Records that this is a different institution, so it is never suggested again. */
export async function keepSchoolSeparate(formData: FormData): Promise<void> {
  await requireAdmin()
  const sourceId = String(formData.get('sourceId') ?? '')
  if (!sourceId) return
  await prisma.school.update({ where: { id: sourceId }, data: { reviewState: 'KEPT_SEPARATE' } })
  revalidatePath(BASE)
}
