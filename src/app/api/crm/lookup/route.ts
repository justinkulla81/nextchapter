import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyCaptureToken } from '@/lib/crm/capture-token'
import { slugOf } from '@/lib/crm/linkedin'
import { sinceLabel } from '@/lib/crm/labels'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * "Is this person already in the CRM?" — read-only counterpart to the
 * capture route's own dedup check, called from the extension popup as soon
 * as it opens on a LinkedIn profile, before the user fills anything in. The
 * capture route already refuses to double-create on save, but by then
 * you've already typed a note and picked a contact type for someone who
 * turns out to be a duplicate — this answers the question up front instead.
 */
export async function GET(req: NextRequest) {
  const tokenId = await verifyCaptureToken(req.headers.get('authorization'))
  if (!tokenId) return NextResponse.json({ error: 'Invalid or revoked token.' }, { status: 401, headers: CORS })

  const slug = slugOf(req.nextUrl.searchParams.get('url'))
  if (!slug) return NextResponse.json({ exists: false }, { headers: CORS })

  const person = await prisma.crmPerson.findUnique({
    where: { linkedinSlug: slug },
    select: { id: true, fullName: true, deletedAt: true, priority: true, lastTouchedAt: true },
  })
  if (!person || person.deletedAt) return NextResponse.json({ exists: false }, { headers: CORS })

  return NextResponse.json(
    {
      exists: true,
      personId: person.id,
      fullName: person.fullName,
      priority: person.priority,
      lastContacted: sinceLabel(person.lastTouchedAt),
    },
    { headers: CORS }
  )
}
