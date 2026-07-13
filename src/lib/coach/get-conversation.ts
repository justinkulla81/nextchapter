import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { COACH_OPENING_MESSAGE } from '@/lib/constants/coach'

export async function getOrCreateCoachConversation(candidateId: string) {
  const existing = await prisma.coachConversation.findUnique({
    where: { candidateId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (existing) return existing

  try {
    return await prisma.coachConversation.create({
      data: {
        candidateId,
        messages: { create: [{ role: 'assistant', content: COACH_OPENING_MESSAGE }] },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    })
  } catch (error) {
    // Two concurrent dashboard loads (e.g. double-render, fast repeat
    // navigation) can both see no existing conversation and race to create
    // one — candidateId is unique, so the loser here just reads what the
    // winner created instead of throwing.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return prisma.coachConversation.findUniqueOrThrow({
        where: { candidateId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      })
    }
    throw error
  }
}
