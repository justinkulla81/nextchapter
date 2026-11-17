'use server'

import { redirect } from 'next/navigation'
import { getOrgUser } from '@/lib/supabase/get-current-user'
import { acceptMemberInvite, memberInvite } from '@/lib/workforce/member-access'
import { acceptContactInvite } from '@/lib/workforce/member-contacts'
import { captureServerEvent } from '@/lib/posthog/server'
import { orgAppPath } from '@/lib/org-hosts'

export async function acceptInvite(slug: string, token: string): Promise<{ error?: string }> {
  const user = await getOrgUser()
  if (!user) return { error: 'Sign in first, with the email the invite went to.' }
  // The company's main contact (whole view), or a contact with a role (hiring, outplacement).
  if (!(await memberInvite(slug, token))) {
    const c = await acceptContactInvite({ slug, token, userId: user.id, email: user.email ?? null })
    if ('error' in c) return { error: c.error }
    captureServerEvent(user.id, 'company_contact_joined', { institutionId: c.institutionId, companyId: c.companyId, roles: c.roles })
    redirect(orgAppPath(slug, 'workforce', '/employer'))
  }
  const r = await acceptMemberInvite({ slug, token, userId: user.id, email: user.email ?? null })
  if ('error' in r) return { error: r.error }
  captureServerEvent(user.id, 'hub_member_company_connected', { institutionId: r.institutionId, companyId: r.companyId })
  redirect(orgAppPath(slug, 'workforce', '/employer'))
}
