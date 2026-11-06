import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { toCsv } from '@/lib/seo/search-analysis'
import {
  ORG_HEADER,
  ORG_KINDS,
  PEOPLE_HEADER,
  buildOrgRows,
  buildPeopleRows,
  orgCsvRows,
  peopleCsvRows,
  type OrgKind,
} from '@/lib/linkedin/audience-export'

// Admin download of a LinkedIn Matched Audience file: ?list=orgs (company list) or ?list=people (contact list), optionally
// &kinds=WORKFORCE_BOARD,WORKFORCE,ECON_DEV,CHAMBER to narrow it. Read-only; nothing is sent to LinkedIn from here.
// The people list needs the owner's privacy-policy decision before it is uploaded (see src/lib/linkedin/audience-export.ts).
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const admin = await requireAdmin()
  const params = request.nextUrl.searchParams
  const list = params.get('list')
  if (list !== 'orgs' && list !== 'people') return NextResponse.json({ ok: false, message: 'Use ?list=orgs or ?list=people.' }, { status: 400 })

  const asked = (params.get('kinds') ?? '').split(',').map((k) => k.trim()).filter(Boolean)
  const kinds = asked.length ? (asked.filter((k): k is OrgKind => (ORG_KINDS as readonly string[]).includes(k))) : [...ORG_KINDS]
  if (!kinds.length) return NextResponse.json({ ok: false, message: `Kinds can be ${ORG_KINDS.join(', ')}.` }, { status: 400 })

  const [boards, leads] = await Promise.all([
    prisma.workforceBoard.findMany({
      select: { name: true, website: true, state: true, directorName: true, directorTitle: true, directorEmail: true, chairName: true, chairEmail: true },
      orderBy: { name: 'asc' },
    }),
    prisma.geoOrgLead.findMany({
      where: { dismissedAt: null, kind: { in: kinds.filter((k) => k !== 'WORKFORCE_BOARD') } },
      select: { name: true, kind: true, state: true, city: true, website: true, contactName: true, contactTitle: true, contactEmail: true },
      orderBy: { name: 'asc' },
    }),
  ])

  const csv =
    list === 'orgs'
      ? toCsv(ORG_HEADER, orgCsvRows(buildOrgRows(boards, leads, kinds)))
      : toCsv(PEOPLE_HEADER, peopleCsvRows(buildPeopleRows(boards, leads, kinds)))
  const rows = csv.split('\n').length - 1
  captureServerEvent(admin.id, 'linkedin_audience_exported', { list, kinds, rows })

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="linkedin-${list === 'orgs' ? 'company' : 'contact'}-list-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
