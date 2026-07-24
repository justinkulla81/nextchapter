'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { resolveEmployerForUserId } from '@/lib/talent/get-employer-for-user'
import { extractRoleFromJD, type ExtractedRoleFields } from '@/lib/roles/extract-role-from-jd'
import { captureServerEvent } from '@/lib/posthog/server'

export type RoleFormState = { error?: string } | undefined

export async function createRole(_prevState: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'You need to be logged in to do this.' }

  const employer = await resolveEmployerForUserId(user.id)
  if (!employer) return { error: 'You need to be logged in to do this.' }

  const roleTitle = (formData.get('roleTitle') as string | null)?.trim()
  if (!roleTitle) return { error: 'Please enter a role title.' }

  const primaryFunction = (formData.get('primaryFunction') as string | null) || null
  const roleLevel = (formData.get('roleLevel') as string | null) || null
  const locationRequirement = (formData.get('locationRequirement') as string | null)?.trim() || null
  const remotePolicy = (formData.get('remotePolicy') as string | null) || null
  const compMinRaw = formData.get('compMin') as string | null
  const compMaxRaw = formData.get('compMax') as string | null
  const compMin = compMinRaw ? Number(compMinRaw) : null
  const compMax = compMaxRaw ? Number(compMaxRaw) : null
  const viaJdExtraction = formData.get('viaJdExtraction') === 'on'

  const role = await prisma.roleProfile.create({
    data: {
      employerId: employer.id,
      roleTitle,
      primaryFunction,
      roleLevel,
      locationRequirement,
      remotePolicy,
      compMin,
      compMax,
    },
  })

  captureServerEvent(employer.id, 'role_posted', { roleId: role.id, employerId: employer.id, viaJdExtraction })

  redirect(`/talent/roles/${role.id}`)
}

export async function extractRoleFromJDAction(text: string): Promise<ExtractedRoleFields | null> {
  const supabase = await createClient()
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
