import { NextResponse, type NextRequest } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { buildSubmissionPacketData } from '@/lib/recruiter/submission-packet'
import { SubmissionPacketPdfDocument } from '@/lib/recruiter/submission-packet-pdf'
import { captureServerEvent } from '@/lib/posthog/server'

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'candidate'
  )
}

// Generates the branded submission packet PDF (§A6.2) for one candidate,
// scoped to this recruiter's own active introduction — buildSubmissionPacketData
// re-checks consent itself, so this route has no separate access-control
// logic to keep in sync with introductions.ts.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id } })
  if (!recruiter) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const candidateId = request.nextUrl.searchParams.get('candidateId')
  if (!candidateId) return NextResponse.json({ error: 'Missing candidateId.' }, { status: 400 })

  const data = await buildSubmissionPacketData(candidateId, recruiter.id)
  if (!data) return NextResponse.json({ error: 'Candidate not found or not consented to you.' }, { status: 404 })

  const fileBuffer = await renderToBuffer(SubmissionPacketPdfDocument(data))

  captureServerEvent(recruiter.id, 'recruiter_submission_packet_generated', { recruiterId: recruiter.id, candidateId })

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${slugify(data.candidateName)}-submission-packet.pdf"`,
    },
  })
}
