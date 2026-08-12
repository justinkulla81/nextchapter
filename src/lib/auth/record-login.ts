import 'server-only'
import { prisma } from '@/lib/prisma'

// Collapses repeated dashboard page loads within one sitting into a single
// login event — getDashboardData runs on every candidate page request, but a
// "login history" should read as one row per time they showed up, not one
// row per click around the app.
const LOGIN_DEDUPE_WINDOW_MS = 30 * 60 * 1000

// ip/userAgent must be resolved by the caller BEFORE registering the after()
// callback that invokes this — next/headers() throws if called from inside
// after().
export async function recordCandidateLoginIfDue(
  candidateId: string,
  ip: string | null,
  userAgent: string | null
): Promise<void> {
  try {
    const lastEvent = await prisma.candidateLoginEvent.findFirst({
      where: { candidateId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    })
    if (lastEvent && Date.now() - lastEvent.createdAt.getTime() < LOGIN_DEDUPE_WINDOW_MS) return

    await prisma.candidateLoginEvent.create({
      data: { candidateId, ip, userAgent },
    })
  } catch (error) {
    console.error('Failed to record candidate login event:', error)
  }
}
