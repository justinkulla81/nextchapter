import 'server-only'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'

// Collapses repeated dashboard page loads within one sitting into a single
// login event — getDashboardData runs on every candidate page request, but a
// "login history" should read as one row per time they showed up, not one
// row per click around the app.
const LOGIN_DEDUPE_WINDOW_MS = 30 * 60 * 1000

export async function recordCandidateLoginIfDue(candidateId: string): Promise<void> {
  try {
    const lastEvent = await prisma.candidateLoginEvent.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (lastEvent && Date.now() - lastEvent.createdAt.getTime() < LOGIN_DEDUPE_WINDOW_MS) return

    const [ip, h] = await Promise.all([getClientIp(), headers()])
    await prisma.candidateLoginEvent.create({
      data: { candidateId, ip, userAgent: h.get('user-agent') },
    })
  } catch (error) {
    console.error('Failed to record candidate login event:', error)
  }
}
