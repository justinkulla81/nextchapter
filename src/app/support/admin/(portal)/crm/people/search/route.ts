import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 15

// Backs the connector picker. A datalist of 3,688 people would be absurd to
// ship to the browser, so this returns the handful that match what's typed.
export async function GET(req: NextRequest) {
  await requireAdmin()
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
  const exclude = req.nextUrl.searchParams.get('exclude') ?? ''
  if (q.length < 2) return Response.json({ people: [] })

  const people = await prisma.crmPerson.findMany({
    where: {
      ...(exclude ? { id: { not: exclude } } : {}),
      OR: [
        { fullName: { contains: q, mode: 'insensitive' } },
        { affiliations: { some: { org: { name: { contains: q, mode: 'insensitive' } } } } },
      ],
    },
    // Connections you actually have come first — a connector who isn't a real
    // contact is a lead on a lead, not a route.
    orderBy: [{ connectedAt: { sort: 'desc', nulls: 'last' } }, { priorityScore: 'desc' }],
    take: 8,
    select: {
      id: true, fullName: true, connectedAt: true,
      affiliations: { where: { isPrimary: true }, take: 1, select: { title: true, org: { select: { name: true } } } },
    },
  })

  return Response.json({
    people: people.map((p) => ({
      id: p.id,
      name: p.fullName,
      detail: [p.affiliations[0]?.title, p.affiliations[0]?.org.name].filter(Boolean).join(' at ') || null,
      isConnection: Boolean(p.connectedAt),
    })),
  })
}
