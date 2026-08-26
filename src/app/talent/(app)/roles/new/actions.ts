'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { resolveEmployerForUserId } from '@/lib/talent/get-employer-for-user'
import { extractRoleFromJD, type ExtractedRoleFields } from '@/lib/roles/extract-role-from-jd'
import { captureServerEvent } from '@/lib/posthog/server'
import { triggerRoleMatchNotifications } from '@/lib/roles/notify-strong-fit-candidates'
import type { CompArrangement, RoleProfileType } from '@prisma/client'

const ROLE_PROFILE_TYPES: RoleProfileType[] = ['FULL_TIME', 'BOARD_PAID', 'BOARD_UNPAID', 'CONSULTING_PAID', 'CONSULTING_UNPAID']
const UNPAID_TYPES = new Set<RoleProfileType>(['BOARD_UNPAID', 'CONSULTING_UNPAID'])

export type RoleFormState = { error?: string } | undefined

export async function createRole(_prevState: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const supabase = await createClient('talent')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const employer = await resolveEmployerForUserId(user.id)
  if (!employer) return { error: 'You need to be logged in to do this.' }

  const roleTitle = (formData.get('roleTitle') as string | null)?.trim()
  if (!roleTitle) return { error: 'Please enter a role title.' }

  const typeRaw = formData.get('type') as string | null
  const type: RoleProfileType = ROLE_PROFILE_TYPES.includes(typeRaw as RoleProfileType)
    ? (typeRaw as RoleProfileType)
    : 'FULL_TIME'
  const description = (formData.get('description') as string | null)?.trim() || null
  const primaryFunction = (formData.get('primaryFunction') as string | null) || null
  const roleLevel = (formData.get('roleLevel') as string | null) || null
  const locationRequirement = (formData.get('locationRequirement') as string | null)?.trim() || null
  const remotePolicy = (formData.get('remotePolicy') as string | null) || null

  // Server-side normalization, not trusted from the client form state — an
  // unpaid type or a "discuss later" arrangement never gets a numeric comp
  // range, regardless of what hidden fields happened to be submitted.
  const compArrangementRaw = formData.get('compArrangement') as string | null
  const compArrangement: CompArrangement = UNPAID_TYPES.has(type)
    ? 'UNPAID'
    : compArrangementRaw === 'OPEN_TO_DISCUSS'
      ? 'OPEN_TO_DISCUSS'
      : 'FIXED_RANGE'
  const compMinRaw = formData.get('compMin') as string | null
  const compMaxRaw = formData.get('compMax') as string | null
  const compMin = compArrangement === 'FIXED_RANGE' && compMinRaw ? Number(compMinRaw) : null
  const compMax = compArrangement === 'FIXED_RANGE' && compMaxRaw ? Number(compMaxRaw) : null
  const viaJdExtraction = formData.get('viaJdExtraction') === 'on'

  const role = await prisma.roleProfile.create({
    data: {
      employerId: employer.id,
      type,
      description,
      compArrangement,
      roleTitle,
      primaryFunction,
      roleLevel,
      locationRequirement,
      remotePolicy,
      compMin,
      compMax,
    },
  })

  captureServerEvent(employer.id, 'role_posted', { roleId: role.id, employerId: employer.id, viaJdExtraction, type })

  // Awaited, not fire-and-forget — a serverless function can be frozen
  // right after redirect() sends its response, which would silently kill
  // in-flight email sends. Promise.allSettled inside already parallelizes
  // every candidate's send, so the added latency here is bounded by one
  // Resend round-trip, not one per candidate. A notification failure must
  // never block the redirect itself, though — the role is already created
  // and real either way.
  try {
    await triggerRoleMatchNotifications(role.id)
  } catch (error) {
    console.error('Failed to trigger role match notifications:', error)
  }

  redirect(`/talent/roles/${role.id}`)
}

export async function extractRoleFromJDAction(text: string): Promise<ExtractedRoleFields | null> {
  const supabase = await createClient('talent')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const employer = await resolveEmployerForUserId(user.id)
  if (!employer) return null

  if (!text.trim()) return null

  const fields = await extractRoleFromJD(text)
  const fieldsPopulatedCount = Object.values(fields).filter((v) => v !== null).length
  captureServerEvent(employer.id, 'role_jd_extracted', { employerId: employer.id, fieldsPopulatedCount })
  return fields
}
