import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

// Generalized unsubscribe for the Weekly Market Digest, which sends to 4
// audiences that don't share a model — the original /api/unsubscribe/[candidateId]
// route stays untouched for its existing 4 candidate-only email types. Nested
// under a static "audience" segment (not directly under /api/unsubscribe/)
// because Next.js's App Router rejects sibling dynamic segments with
// different param names at the same directory level — [audience] can't sit
// next to the existing [candidateId] directory.
type Audience = 'candidate' | 'coach' | 'recruiter' | 'employer'

const AUDIENCE_LABEL: Record<Audience, string> = {
  candidate: 'the Weekly Market Digest',
  coach: 'the Weekly Market Digest',
  recruiter: 'the Weekly Market Digest',
  employer: 'the Weekly Market Digest',
}

async function optOut(audience: Audience, id: string): Promise<void> {
  const data = { marketDigestOptedOut: true }
  switch (audience) {
    case 'candidate':
      await prisma.candidateProfile.update({ where: { id }, data })
      return
    case 'coach':
      await prisma.coach.update({ where: { id }, data })
      return
    case 'recruiter':
      await prisma.recruiter.update({ where: { id }, data })
      return
    case 'employer':
      await prisma.employerProfile.update({ where: { id }, data })
      return
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ audience: string; id: string }> }) {
  const { audience, id } = await params

  if (!['candidate', 'coach', 'recruiter', 'employer'].includes(audience)) {
    return new NextResponse('Unknown unsubscribe link.', { status: 404 })
  }

  await optOut(audience as Audience, id).catch(() => {
    // Unknown/already-deleted account — still show the same confirmation so
    // this link never errors visibly for a recipient.
  })

  const message = `You won't receive ${AUDIENCE_LABEL[audience as Audience]} anymore.`

  return new NextResponse(
    `<!doctype html><html><body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 64px auto; padding: 0 24px; color: #111;"><p>${message}</p></body></html>`,
    { headers: { 'content-type': 'text/html' } }
  )
}
