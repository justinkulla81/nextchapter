'use server'

import { memberForToken, resubscribeMember, suppressMember } from '@/lib/higher-ed/email-events'

export async function setCollegeEmails(slug: string, token: string, on: boolean): Promise<{ error?: string; on?: boolean }> {
  const m = await memberForToken(token)
  if (!m || m.institution.slug !== slug) return { error: 'This link isn’t valid any more.' }
  if (on) {
    const ok = await resubscribeMember(m.id)
    return ok ? { on: true } : { error: 'Emails can’t be turned back on from here. Contact your alumni office.' }
  }
  await suppressMember(m.id, 'UNSUBSCRIBED')
  return { on: false }
}
