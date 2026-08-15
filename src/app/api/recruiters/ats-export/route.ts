import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { buildSubmissionPacketData } from '@/lib/recruiter/submission-packet'
import { buildAtsExportPayload, type AtsDestination } from '@/lib/recruiter/ats-export'
import { EXPORT_DESTINATIONS } from '@/lib/constants/recruiter-export-destinations'
import { captureServerEvent } from '@/lib/posthog/server'

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'candidate'
  )
}

function isAtsDestination(value: string | null): value is AtsDestination {
  return !!value && (EXPORT_DESTINATIONS as readonly string[]).includes(value)
}

// §A6.2 — "one-click export to Greenhouse/Lever/Bullhorn." See
// ats-export.ts's header comment for the honest scope note: this is a
// downloadable, correctly-formatted export file, not a live API push.
// Gated to destinations the recruiter's firm has actually been enabled for
// (RecruiterFirm.exportDestinationsEnabled, §A6.4, admin-managed) — a
// recruiter with no firm link, or a firm not enabled for a given
// destination, gets a clear error instead of a silent export.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const recruiter = await prisma.recruiter.findUnique({ where: { userId: user.id }, include: { recruiterFirm: true } })
  if (!recruiter) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const candidateId = request.nextUrl.searchParams.get('candidateId')
  const destination = request.nextUrl.searchParams.get('destination')
  if (!candidateId) return NextResponse.json({ error: 'Missing candidateId.' }, { status: 400 })
  if (!isAtsDestination(destination)) {
    return NextResponse.json({ error: 'Unknown export destination.' }, { status: 400 })
  }

  const enabled = recruiter.recruiterFirm?.exportDestinationsEnabled ?? []
  if (!enabled.includes(destination)) {
    return NextResponse.json(
      { error: `Your firm hasn't been enabled for ${destination} export yet — ask your NextChapter admin.` },
      { status: 403 }
    )
  }

  const data = await buildSubmissionPacketData(candidateId, recruiter.id)
  if (!data) return NextResponse.json({ error: 'Candidate not found or not consented to you.' }, { status: 404 })

  const payload = buildAtsExportPayload(destination, data)

  captureServerEvent(recruiter.id, 'recruiter_ats_export_downloaded', { recruiterId: recruiter.id, candidateId, destination })

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${slugify(data.candidateName)}-${destination}-export.json"`,
    },
  })
}
