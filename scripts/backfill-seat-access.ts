// One-off: give already-activated outplacement seats what their package
// includes (coaching sessions, recruiter network). Idempotent.
import { prisma } from '@/lib/prisma'
import { grantSeatAccess } from '@/lib/access/grants'

async function main() {
  const seats = await prisma.outplacementSeat.findMany({ where: { status: 'ACTIVATED', candidateId: { not: null } }, select: { id: true } })
  const tally: Record<string, number> = {}
  for (const s of seats) {
    const r = await grantSeatAccess(s.id, 'backfill-2026-10-15')
    for (const f of r.granted) tally[f] = (tally[f] ?? 0) + 1
  }
  console.log({ seats: seats.length, tally })
}
main().finally(() => prisma.$disconnect())
