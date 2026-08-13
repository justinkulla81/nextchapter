'use server'

import { revalidatePath } from 'next/cache'
import type { AlumniGroupMatchType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'

export type FormState = { error?: string } | undefined

const MATCH_TYPES: AlumniGroupMatchType[] = ['EMPLOYER', 'SCHOOL']

function parseCommon(formData: FormData) {
  const name = (formData.get('name') as string | null)?.trim() ?? ''
  const matchTypeRaw = (formData.get('matchType') as string | null) ?? ''
  const url = (formData.get('url') as string | null)?.trim() ?? ''
  const logoUrl = (formData.get('logoUrl') as string | null)?.trim() || null
  const description = (formData.get('description') as string | null)?.trim() || null
  const isActive = formData.get('isActive') === 'on'
  const sortOrderRaw = (formData.get('sortOrder') as string | null)?.trim()
  const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : null
  const keywordsRaw = (formData.get('keywords') as string | null) ?? ''
  const keywords = keywordsRaw
    .split('\n')
    .map((k) => k.trim())
    .filter(Boolean)

  if (!name) return { error: 'Name is required.' as const }
  if (!MATCH_TYPES.includes(matchTypeRaw as AlumniGroupMatchType)) return { error: 'Choose employer or school.' as const }
  if (!url) return { error: 'Link is required.' as const }
  if (keywords.length === 0) return { error: 'At least one match keyword is required.' as const }

  return {
    data: {
      name,
      matchType: matchTypeRaw as AlumniGroupMatchType,
      url,
      logoUrl,
      description,
      isActive,
      sortOrder,
      keywords,
    },
  }
}

export async function createAlumniGroup(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const parsed = parseCommon(formData)
  if ('error' in parsed) return { error: parsed.error }

  const group = await prisma.alumniNetworkGroup.create({ data: { ...parsed.data, addedByAdminId: admin?.email ?? null } })
  captureServerEvent(admin?.email ?? 'admin', 'alumni_group_created', { groupId: group.id, matchType: group.matchType })
  revalidatePath('/support/admin/alumni-groups')
}

export async function updateAlumniGroup(groupId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()
  const parsed = parseCommon(formData)
  if ('error' in parsed) return { error: parsed.error }

  await prisma.alumniNetworkGroup.update({ where: { id: groupId }, data: parsed.data })
  captureServerEvent(admin?.email ?? 'admin', 'alumni_group_updated', { groupId })
  revalidatePath('/support/admin/alumni-groups')
  revalidatePath('/dashboard/network')
}

export async function toggleAlumniGroupActive(groupId: string, current: boolean) {
  await requireAdmin()
  await prisma.alumniNetworkGroup.update({ where: { id: groupId }, data: { isActive: !current } })
  revalidatePath('/support/admin/alumni-groups')
  revalidatePath('/dashboard/network')
}

export async function deleteAlumniGroup(groupId: string) {
  await requireAdmin()
  await prisma.alumniNetworkGroup.delete({ where: { id: groupId } })
  revalidatePath('/support/admin/alumni-groups')
  revalidatePath('/dashboard/network')
}
