import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

// NextChapter Talent: unsubscribe link in every candidate-facing email
// (confirmation, recruiter reply, claim reminder). Stops reminders and any
// reply still waiting for approval. Same page whether or not the token is
// known, so the link never errors visibly.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const candidate = await prisma.intakeCandidate.findUnique({ where: { claimToken: token } })
  if (candidate && !candidate.emailOptedOutAt) {
    await prisma.intakeCandidate.update({ where: { id: candidate.id }, data: { emailOptedOutAt: new Date() } })
    await prisma.intakeReply.updateMany({
      where: { status: { in: ['DRAFT', 'APPROVED'] }, connection: { intakeCandidateId: candidate.id } },
      data: { status: 'CANCELLED', cancelledById: 'unsubscribe', cancelledAt: new Date() },
    })
    captureServerEvent(candidate.id, 'talent_candidate_unsubscribed', { intakeCandidateId: candidate.id })
  }
  return new NextResponse(
    `<!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 64px auto; padding: 0 24px; color: #111;"><p>You won't get any more emails about this resume from NextChapter.</p></body></html>`,
    { headers: { 'content-type': 'text/html' } }
  )
}
