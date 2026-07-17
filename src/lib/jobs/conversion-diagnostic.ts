import type { ApplicationChannel } from '@prisma/client'

export const APPLICATION_CHANNEL_LABELS: Record<ApplicationChannel, string> = {
  COLD_APPLICATION: 'Cold application',
  REFERRAL: 'Referral',
  RECRUITER_OUTREACH: 'Recruiter outreach',
  WARM_NETWORK_INTRO: 'Warm network intro',
  OTHER: 'Other',
}

// Below this many channel-tagged applications, a per-channel interview rate
// is just noise — one lucky or unlucky application would swing it wildly.
const MIN_APPLICATIONS_FOR_DIAGNOSTIC = 3

export interface ChannelConversion {
  channel: ApplicationChannel
  appliedCount: number
  interviewCount: number
  interviewRate: number // 0-1
}

export function computeConversionDiagnostic(
  postings: { channel: ApplicationChannel | null; appliedAt: Date | null; interviewLandedAt: Date | null }[]
): ChannelConversion[] | null {
  const tagged = postings.filter((p) => p.appliedAt !== null && p.channel !== null)
  if (tagged.length < MIN_APPLICATIONS_FOR_DIAGNOSTIC) return null

  const byChannel = new Map<ApplicationChannel, { applied: number; interviewed: number }>()
  for (const posting of tagged) {
    const channel = posting.channel as ApplicationChannel
    const entry = byChannel.get(channel) ?? { applied: 0, interviewed: 0 }
    entry.applied += 1
    if (posting.interviewLandedAt !== null) entry.interviewed += 1
    byChannel.set(channel, entry)
  }

  return Array.from(byChannel.entries())
    .map(([channel, { applied, interviewed }]) => ({
      channel,
      appliedCount: applied,
      interviewCount: interviewed,
      interviewRate: interviewed / applied,
    }))
    .sort((a, b) => b.interviewRate - a.interviewRate)
}
