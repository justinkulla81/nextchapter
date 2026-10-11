'use server'

import { finishAcceptingInstitutionInvite as impl } from '@/lib/institution/invite'

// Thin 'use server' wrapper so CallbackHandler (a Client Component) can finish
// a college staff invite; the person then lands in /i/<slug>.
export async function finishAcceptingInstitutionInvite(inviteToken: string): Promise<{ error?: string; slug?: string }> {
  return impl(inviteToken)
}
