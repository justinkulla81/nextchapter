// Channels component — network + outreach activity. Voice/Intake Spec §5:
// above director level this is the dominant channel, and the thing that
// actually moves it is activity, not list size — a candidate can have 200
// contacts and zero recent outreach. Weighted accordingly below.

import 'server-only'
import { prisma } from '@/lib/prisma'
import type { ComponentComputation } from './types'

const OUTREACH_WINDOW_DAYS = 30

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

export async function computeChannelsComponent(candidateId: string): Promise<ComponentComputation> {
  const windowStart = new Date(Date.now() - OUTREACH_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [contactCount, recentOutreachCount] = await Promise.all([
    prisma.supportNetworkContact.count({ where: { candidateId, removedAt: null } }),
    prisma.outreachLog.count({ where: { candidateId, loggedAt: { gte: windowStart } } }),
  ])

  // Saturating curves — a candidate doesn't need an enormous network or a
  // daily outreach cadence to score well, just evidence the channel is
  // actually in use. 25 contacts / 8 touches in 30 days is full credit.
  const networkSizeScore = Math.min(100, contactCount * 4)
  const activityScore = Math.min(100, recentOutreachCount * 12.5)

  const score = clamp(0.4 * networkSizeScore + 0.6 * activityScore)

  const drivers: string[] = []
  if (recentOutreachCount === 0) {
    drivers.push(
      contactCount > 0
        ? `${contactCount} contacts in the network list, but no outreach logged in the last ${OUTREACH_WINDOW_DAYS} days.`
        : 'No network contacts and no outreach logged yet — this channel is currently unused.'
    )
  } else {
    drivers.push(`${recentOutreachCount} outreach touches in the last ${OUTREACH_WINDOW_DAYS} days.`)
  }

  return { score, drivers }
}
