'use server'

import { finishAcceptingInstitutionInvite as impl } from '@/lib/institution/invite'

// Thin 'use server' wrapper so CallbackHandler (a Client Component) can call it.
export async function finishAcceptingInstitutionInvite(inviteToken: string): Promise<{ error?: string }> {
  return impl(inviteToken)
}
