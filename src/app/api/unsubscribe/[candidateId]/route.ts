import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const { candidateId } = await params
  const isDaily = request.nextUrl.searchParams.get('type') === 'daily'

  await prisma.candidateProfile
    .update({
      where: { id: candidateId },
      data: isDaily ? { dailyEmailOptedOut: true } : { reminderEmailsOptedOut: true },
    })
    .catch(() => {
      // Unknown/already-deleted candidate — nothing to do, still show the
      // same confirmation so this link never errors visibly for a recipient.
    })

  const message = isDaily
    ? "You won't receive any more daily action emails from Vic."
    : "You won't receive any more reminder emails from NextChapter about finishing your account."

  return new NextResponse(
    `<!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 64px auto; padding: 0 24px; color: #111;"><p>${message}</p></body></html>`,
    { headers: { 'content-type': 'text/html' } }
  )
}
