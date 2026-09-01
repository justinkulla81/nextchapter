import 'server-only'
import { prisma } from '@/lib/prisma'
import { notifyAdminOfCandidateLogin } from '@/lib/email/send-admin-candidate-login'

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

    // Awaited (not fire-and-forget) — this whole function runs inside
    // next/server's after(), which only keeps the process alive until the
    // promise IT was given resolves; an un-awaited send here could get cut
    // off before it actually goes out. notifyAdminOfCandidateLogin has its
    // own internal try/catch, so a failed send still can't throw past this
    // point. Direct instruction to email admin on every real login — deduped
    // to once per LOGIN_DEDUPE_WINDOW_MS by the early-return above, not once
    // per page load.
    await notifyAdminOfCandidateLogin(candidateId, ip)
  } catch (error) {
    console.error('Failed to record candidate login event:', error)
  }
}
