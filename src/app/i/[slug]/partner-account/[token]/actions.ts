'use server'

import { redirect } from 'next/navigation'
import { getOrgUser } from '@/lib/supabase/get-current-user'
import { acceptAccess } from '@/lib/workforce/partner-access'
import { captureServerEvent } from '@/lib/posthog/server'
import { orgAppPath } from '@/lib/org-hosts'

export async function acceptPartnerAccess(slug: string, token: string): Promise<{ error?: string }> {
  const user = await getOrgUser()
  if (!user) return { error: 'Sign in first, with the email this link went to.' }
  const r = await acceptAccess({ slug, token, userId: user.id, email: user.email ?? null })
  if ('error' in r) return { error: r.error }
  captureServerEvent(user.id, 'partner_access_accepted', { institutionId: r.institutionId, partnerId: r.partnerId })
  redirect(orgAppPath(slug, 'workforce', '/partnerview'))
}
