'use server'

import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { acceptMemberInvite } from '@/lib/workforce/member-access'
import { captureServerEvent } from '@/lib/posthog/server'

export async function acceptInvite(slug: string, token: string): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Sign in first, with the email the invite went to.' }
  const r = await acceptMemberInvite({ slug, token, userId: user.id, email: user.email ?? null })
  if ('error' in r) return { error: r.error }
  captureServerEvent(user.id, 'hub_member_company_connected', { institutionId: r.institutionId, companyId: r.companyId })
  redirect(`/i/${slug}/employer`)
}
