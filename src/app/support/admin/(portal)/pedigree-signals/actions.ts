'use server'

import { revalidatePath } from 'next/cache'
import type { PedigreeSignalCategory } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

const PATH = '/support/admin/pedigree-signals'

export async function createEliteInstitution(formData: FormData) {
  await requireAdmin()
  const name = (formData.get('name') as string | null)?.trim()
  if (!name) return
  await prisma.eliteInstitution.create({ data: { name, nameNormalized: normalize(name) } })
  revalidatePath(PATH)
}

export async function toggleEliteInstitution(id: string, isActive: boolean) {
  await requireAdmin()
  await prisma.eliteInstitution.update({ where: { id }, data: { isActive: !isActive } })
  revalidatePath(PATH)
}

export async function deleteEliteInstitution(id: string) {
  await requireAdmin()
  await prisma.eliteInstitution.delete({ where: { id } })
  revalidatePath(PATH)
}

export async function createPrestigeEmployer(formData: FormData) {
  await requireAdmin()
  const name = (formData.get('name') as string | null)?.trim()
  if (!name) return
  await prisma.prestigeEmployer.create({ data: { name, nameNormalized: normalize(name) } })
  revalidatePath(PATH)
}

export async function togglePrestigeEmployer(id: string, isActive: boolean) {
  await requireAdmin()
  await prisma.prestigeEmployer.update({ where: { id }, data: { isActive: !isActive } })
  revalidatePath(PATH)
}

export async function deletePrestigeEmployer(id: string) {
  await requireAdmin()
  await prisma.prestigeEmployer.delete({ where: { id } })
  revalidatePath(PATH)
}

export async function createHighDemandSignal(formData: FormData) {
  await requireAdmin()
  const label = (formData.get('label') as string | null)?.trim()
  const category = (formData.get('category') as string | null) as PedigreeSignalCategory | null
  const keywordsRaw = (formData.get('keywords') as string | null) ?? ''
  const keywords = keywordsRaw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
  if (!label || !category || keywords.length === 0) return
  await prisma.highDemandSignal.create({ data: { label, category, keywords } })
  revalidatePath(PATH)
}

export async function toggleHighDemandSignal(id: string, isActive: boolean) {
  await requireAdmin()
  await prisma.highDemandSignal.update({ where: { id }, data: { isActive: !isActive } })
  revalidatePath(PATH)
}

export async function deleteHighDemandSignal(id: string) {
  await requireAdmin()
  await prisma.highDemandSignal.delete({ where: { id } })
  revalidatePath(PATH)
}

export async function setExceptionalGradeOverride(candidateId: string, enable: boolean, reason: string) {
  const admin = await requireAdmin()
  if (enable && !reason.trim()) return { error: 'A reason is required to grant an Exceptional Profile override.' }
  await prisma.candidateProfile.update({
    where: { id: candidateId },
    data: enable
      ? {
          exceptionalGradeOverride: true,
          exceptionalGradeOverrideReason: reason.trim(),
          exceptionalGradeOverrideBy: admin.email,
          exceptionalGradeOverrideAt: new Date(),
        }
      : {
          exceptionalGradeOverride: false,
          exceptionalGradeOverrideReason: null,
          exceptionalGradeOverrideBy: null,
          exceptionalGradeOverrideAt: null,
        },
  })
  revalidatePath(`/support/admin/candidates/${candidateId}`)
  return undefined
}
