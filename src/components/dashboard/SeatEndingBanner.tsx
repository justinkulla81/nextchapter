import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { continuityCopy, endingSoon } from '@/lib/employer/seat-continuity'
import { programKindOf } from '@/lib/employer/program-wording'

// Shown in the last 30 days of a sponsored seat. Says what stays, what ends and what to do, so the
// end of a benefit is never a surprise and never a loss of someone's own work.
export async function SeatEndingBanner({ candidateId }: { candidateId: string }) {
  const seats = await prisma.outplacementSeat
    .findMany({
      where: { candidateId, status: 'ACTIVATED' },
      select: { accessEndsAt: true, contract: { select: { termEndAt: true, journey: true, org: { select: { name: true } } } } },
    })
    .catch(() => [])
  const ending = endingSoon(seats.map((s) => ({ endsAt: s.accessEndsAt ?? s.contract.termEndAt, orgName: s.contract.org.name, kind: programKindOf(s.contract.journey) })))
  if (!ending) return null
  const copy = continuityCopy(ending.kind)
  const date = ending.endsAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
  return (
    <section className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm" aria-labelledby="seat-ending-heading">
      <h2 id="seat-ending-heading" className="font-semibold text-foreground">
        Your {ending.orgName} benefit ends on {date}
      </h2>
      <p className="text-muted-foreground">
        <strong className="font-medium text-foreground">What stays yours:</strong> {copy.stays.join('; ')}.
      </p>
      <p className="text-muted-foreground">
        <strong className="font-medium text-foreground">What ends:</strong> {copy.ends.join('; ').toLowerCase()}.
      </p>
      <p className="text-muted-foreground">{copy.next}</p>
      <Link href="/dashboard/membership" className="text-primary underline underline-offset-4">
        See membership options
      </Link>
    </section>
  )
}
