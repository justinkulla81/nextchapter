import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const { candidateId } = await params
  const type = request.nextUrl.searchParams.get('type')

  const data =
    type === 'daily'
      ? { dailyEmailOptedOut: true }
      : type === 'weekly'
        ? { weeklyReportOptedOut: true }
        : type === 'sprintGoal'
          ? { sprintGoalEmailsOptedOut: true }
          : { reminderEmailsOptedOut: true }

  await prisma.candidateProfile.update({ where: { id: candidateId }, data }).catch(() => {
    // Unknown/already-deleted candidate — nothing to do, still show the
    // same confirmation so this link never errors visibly for a recipient.
  })

  const message =
    type === 'daily'
      ? "You won't receive any more daily action emails from Vic."
      : type === 'weekly'
        ? "You won't receive the Friday check-in or Community & Coaching digest emails anymore."
        : type === 'sprintGoal'
          ? "You won't receive any more Weekly Search Sprint goal-setting reminders."
          : "You won't receive any more reminder emails from NextChapter about finishing your account."

  return new NextResponse(
    `<!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 64px auto; padding: 0 24px; color: #111;"><p>${message}</p></body></html>`,
    { headers: { 'content-type': 'text/html' } }
  )
}
