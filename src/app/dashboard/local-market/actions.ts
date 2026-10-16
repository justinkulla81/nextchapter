'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/supabase/get-current-user'
import { captureServerEvent } from '@/lib/posthog/server'

async function me() {
  const user = await getCurrentUser()
  if (!user) return null
  return prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
}

// "I'm working with this workforce board." Member-initiated. The board sees
// nothing about the member by name; with shareOutcome on, an anonymous count
// of members who found work can include them (src/lib/workforce/area-brief.ts).
export async function connectBoard(boardId: string): Promise<{ error?: string }> {
  const profile = await me()
  if (!profile) return { error: 'Your session ended. Sign in again.' }
  const board = await prisma.workforceBoard.findUnique({ where: { id: boardId }, select: { id: true, state: true } })
  if (!board) return { error: 'We could not find that board. Reload the page and try again.' }
  await prisma.workforceBoardConnection.upsert({
    where: { candidateId_boardId: { candidateId: profile.id, boardId } },
    create: { candidateId: profile.id, boardId },
    update: { status: 'ACTIVE', endedAt: null },
  })
  captureServerEvent(profile.id, 'workforce_board_connected', { boardId, state: board.state })
  revalidatePath('/dashboard/local-market')
  revalidatePath('/dashboard/privacy')
  return {}
}

export async function disconnectBoard(boardId: string): Promise<{ error?: string }> {
  const profile = await me()
  if (!profile) return { error: 'Your session ended. Sign in again.' }
  const r = await prisma.workforceBoardConnection.updateMany({
    where: { candidateId: profile.id, boardId, status: 'ACTIVE' },
    data: { status: 'ENDED', endedAt: new Date(), shareOutcome: false },
  })
  if (r.count === 0) return { error: 'You are not connected to that board. Reload the page.' }
  captureServerEvent(profile.id, 'workforce_board_disconnected', { boardId })
  revalidatePath('/dashboard/local-market')
  revalidatePath('/dashboard/privacy')
  return {}
}

export async function setShareOutcome(boardId: string, share: boolean): Promise<{ error?: string }> {
  const profile = await me()
  if (!profile) return { error: 'Your session ended. Sign in again.' }
  const r = await prisma.workforceBoardConnection.updateMany({
    where: { candidateId: profile.id, boardId, status: 'ACTIVE' },
    data: { shareOutcome: share },
  })
  if (r.count === 0) return { error: 'You are not connected to that board. Reload the page.' }
  captureServerEvent(profile.id, 'workforce_board_share_outcome_changed', { boardId, share })
  revalidatePath('/dashboard/local-market')
  revalidatePath('/dashboard/privacy')
  return {}
}
