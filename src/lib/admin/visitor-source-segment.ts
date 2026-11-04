import { classifyTrafficSource, trafficSourceGroup } from '@/lib/marketing/classify-traffic-source'

export type SourceSegment = 'Social media' | 'LinkedIn' | 'Email'

// The three outside sources the Visitor activity source chart follows. LinkedIn is split out of the other social
// networks; Email also counts visits through a tracked link in an email we sent (the nc_e tag), which most mail apps
// would otherwise show as Direct. Every other source returns null and is left out.
export function sourceSegment(utmSource: string | null, referrerHost: string | null, emailTagged: boolean): SourceSegment | null {
  if (emailTagged) return 'Email'
  const label = classifyTrafficSource(utmSource ? `/?utm_source=${utmSource}` : null, referrerHost ? `https://${referrerHost}/` : null)
  if (label === 'LinkedIn') return 'LinkedIn'
  const group = trafficSourceGroup(label)
  if (group === 'Email') return 'Email'
  if (group === 'Social') return 'Social media'
  return null
}
