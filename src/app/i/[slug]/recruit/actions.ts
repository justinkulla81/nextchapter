'use server'

import { getOrgUser } from '@/lib/supabase/get-current-user'
import { prisma } from '@/lib/prisma'
import { applyToRecruit } from '@/lib/higher-ed/employers'
import { captureServerEvent } from '@/lib/posthog/server'

export async function applyForCollege(slug: string): Promise<{ error?: string; status?: string }> {
  const user = await getOrgUser()
  if (!user) return { error: 'Sign in with your employer account first.' }
  const inst = await prisma.institution.findUnique({ where: { slug }, select: { id: true } })
  if (!inst) return { error: 'That college isn’t on NextChapter.' }
  const r = await applyToRecruit(inst.id, user.id)
  if ('error' in r) return { error: 'Create your employer account first, then come back to this page.' }
  captureServerEvent(user.id, 'he_employer_applied', { institutionId: inst.id, status: r.status })
  return { status: r.status }
}
