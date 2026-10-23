import 'server-only'
import { prisma } from '@/lib/prisma'
import { loadAddressableMarket } from '@/lib/profile/addressable-market'
import type { OfferSignals } from './triggers'

const DAY = 86_400_000

/** Reads the data the offer rules need. One member at a time, so the market lookup stays cheap. */
export async function loadOfferSignals(
  candidate: { id: string; registrationCompletedAt: Date | null },
  now = new Date(),
): Promise<OfferSignals> {
  const since = new Date(now.getTime() - 14 * DAY)
  const [market, outreachLast14, contacts, visits] = await Promise.all([
    loadAddressableMarket(candidate.id).catch(() => null),
    prisma.outreachLog.count({ where: { candidateId: candidate.id, loggedAt: { gte: since } } }),
    prisma.supportNetworkContact.count({ where: { candidateId: candidate.id } }),
    prisma.candidateVisitDay.count({ where: { candidateId: candidate.id, day: { gte: since } } }),
  ])
  return {
    openRoles: market?.marketReady ? market.local : null,
    roleLabel: market?.role?.label ?? null,
    placeLabel: market?.placeLabel ?? null,
    outreachLast14,
    contacts,
    tenureDays: candidate.registrationCompletedAt ? Math.floor((now.getTime() - candidate.registrationCompletedAt.getTime()) / DAY) : 0,
    activeRecently: visits > 0,
  }
}
