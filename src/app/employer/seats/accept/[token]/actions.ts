'use server'

import { finishAcceptingOutplacementSeat as finishAcceptingOutplacementSeatImpl } from '@/lib/employer/outplacement-enrollment'

// Thin 'use server' wrapper — CallbackHandler (a Client Component) can only
// directly import functions from a file marked 'use server' (Next.js turns
// those into RPC endpoints); the real implementation lives in
// src/lib/employer/outplacement-enrollment.ts (server-only, but not itself
// a Server Action file) alongside the rest of the enrollment logic. Same
// split as finishAcceptingEmployerSeat/finishAcceptingCoachInvite's own
// actions.ts files.
export async function finishAcceptingOutplacementSeat(inviteToken: string): Promise<{ error?: string }> {
  return finishAcceptingOutplacementSeatImpl(inviteToken)
}
