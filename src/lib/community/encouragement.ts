import 'server-only'
import { prisma } from '@/lib/prisma'

const STRUGGLING_WINDOW_DAYS = 7
const STRUGGLING_STUCK_THRESHOLD = 3

export async function isStrugglingThisWeek(candidateId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - STRUGGLING_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const stuckCount = await prisma.dailyCheckIn.count({
    where: { candidateId, mood: 'STUCK', checkedInAt: { gte: windowStart } },
  })
  return stuckCount >= STRUGGLING_STUCK_THRESHOLD
}

// Picks one anonymous struggling candidate (not the giver themselves) for
// the "someone in the Circle needs encouragement" prompt — the giver never
// chooses who, per the spec's "small, human, real" anonymous design.
export async function pickStrugglingCandidateId(excludeCandidateId: string): Promise<string | null> {
  const windowStart = new Date(Date.now() - STRUGGLING_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const candidates = await prisma.candidateProfile.findMany({
    where: {
      id: { not: excludeCandidateId },
      dailyCheckIns: { some: { mood: 'STUCK', checkedInAt: { gte: windowStart } } },
    },
    select: { id: true, dailyCheckIns: { where: { mood: 'STUCK', checkedInAt: { gte: windowStart } } } },
  })
  const struggling = candidates.filter((c) => c.dailyCheckIns.length >= STRUGGLING_STUCK_THRESHOLD)
  if (struggling.length === 0) return null
  return struggling[Math.floor(Math.random() * struggling.length)].id
}

export async function sendEncouragementNote(
  fromCandidateId: string,
  message: string,
  revealSender: boolean
): Promise<{ sent: boolean }> {
  const toCandidateId = await pickStrugglingCandidateId(fromCandidateId)
  if (!toCandidateId) return { sent: false }

  await prisma.encouragementNote.create({
    data: { fromCandidateId, toCandidateId, message, revealSender },
  })
  return { sent: true }
}

export async function getUnreadEncouragementNotes(candidateId: string) {
  return prisma.encouragementNote.findMany({
    where: { toCandidateId: candidateId, readAt: null },
    include: { fromCandidate: { select: { firstName: true, lastName: true } } },
    orderBy: { sentAt: 'desc' },
  })
}

export async function markEncouragementNoteRead(noteId: string, candidateId: string) {
  await prisma.encouragementNote.updateMany({
    where: { id: noteId, toCandidateId: candidateId },
    data: { readAt: new Date() },
  })
}
