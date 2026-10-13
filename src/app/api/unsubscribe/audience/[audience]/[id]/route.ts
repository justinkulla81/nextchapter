import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyLink } from '@/lib/email/signed-links'
import { confirmPage, messagePage } from '@/lib/http/confirm-page'

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

// Unsigned links predate signing and are honoured until this date.
const LEGACY_UNSIGNED_UNTIL = Date.parse('2027-04-13T00:00:00Z')

function authorize(request: NextRequest, audience: string, id: string): boolean {
  const sig = request.nextUrl.searchParams.get('sig')
  if (sig) return verifyLink(sig, 'unsub-audience', audience, id)
  return Date.now() < LEGACY_UNSIGNED_UNTIL
}

const INVALID = 'This unsubscribe link is no longer valid. You can manage your email preferences from your NextChapter account settings.'

// GET shows a confirmation button only — mail scanners fetch every link in an
// email (recruiter and employer inboxes especially), so GET must not opt out.
export async function GET(request: NextRequest, { params }: { params: Promise<{ audience: string; id: string }> }) {
  const { audience, id } = await params
  if (!['candidate', 'coach', 'recruiter', 'employer'].includes(audience)) {
    return new NextResponse('Unknown unsubscribe link.', { status: 404 })
  }
  if (!authorize(request, audience, id)) return messagePage(INVALID, 410)
  return confirmPage({
    message: `Unsubscribe from ${AUDIENCE_LABEL[audience as Audience]}?`,
    button: 'Confirm unsubscribe',
    action: `${request.nextUrl.pathname}${request.nextUrl.search}`,
  })
}

// POST performs the opt-out (and receives mail clients' one-click unsubscribe).
export async function POST(request: NextRequest, { params }: { params: Promise<{ audience: string; id: string }> }) {
  const { audience, id } = await params
  if (!['candidate', 'coach', 'recruiter', 'employer'].includes(audience)) {
    return new NextResponse('Unknown unsubscribe link.', { status: 404 })
  }
  if (!authorize(request, audience, id)) return messagePage(INVALID, 410)

  await optOut(audience as Audience, id).catch(() => {
    // Unknown/already-deleted account — still show the same confirmation so
    // this link never errors visibly for a recipient.
  })

  return messagePage(`You won't receive ${AUDIENCE_LABEL[audience as Audience]} anymore.`)
}
