'use server'

import { finishAcceptingOutplacementOrgInvite as finishAcceptingOutplacementOrgInviteImpl } from '@/lib/employer/outplacement-org-users'

// Thin 'use server' wrapper — see the sibling seats/accept/[token]/actions.ts
// comment for why this indirection exists (CallbackHandler, a Client
// Component, needs a 'use server'-marked export to call into).
export async function finishAcceptingOutplacementOrgInvite(inviteToken: string): Promise<{ error?: string }> {
  return finishAcceptingOutplacementOrgInviteImpl(inviteToken)
}
