// Campaign links carry their audience in utm_campaign as "<segment>-<channel>", for example
// laid-off-recent-google. The segment is one of the audiences we want to compare for engagement;
// the channel is where the link was placed. Anything else is reported as "untagged" with its
// campaign text kept, so an untagged link is visible rather than lost.

export const SEGMENTS = [
  { key: 'laid-off-recent', label: 'Recently laid off (0 to 90 days)' },
  { key: 'laid-off-long', label: 'Long-term laid off (6+ months)' },
  { key: 'career-change', label: 'Career changers' },
  { key: 'returner', label: 'Returners' },
  { key: 'ai-retraining', label: 'AI retraining seekers' },
  { key: 'senior', label: 'Senior (VP and above)' },
] as const

export const UNTAGGED = 'untagged'

export interface UtmTags {
  source: string | null
  medium: string | null
  campaign: string | null
}

function decode(value: string | null): string | null {
  if (!value) return null
  try {
    return decodeURIComponent(value.replace(/\+/g, ' ')).trim().toLowerCase() || null
  } catch {
    return value.trim().toLowerCase() || null
  }
}

/** Reads utm_source, utm_medium and utm_campaign off a stored landing path. Null when the path has no query. */
export function parseUtm(path: string | null): UtmTags | null {
  if (!path) return null
  const queryStart = path.indexOf('?')
  if (queryStart === -1) return null
  const params = new URLSearchParams(path.slice(queryStart + 1).split('#')[0])
  const tags = { source: decode(params.get('utm_source')), medium: decode(params.get('utm_medium')), campaign: decode(params.get('utm_campaign')) }
  return tags.source || tags.medium || tags.campaign ? tags : null
}

/** Splits "<segment>-<channel>" at a known segment. An unknown or missing campaign is untagged. */
export function splitCampaign(campaign: string | null): { segment: string; channel: string } {
  const value = decode(campaign)
  if (!value) return { segment: UNTAGGED, channel: '' }
  for (const s of SEGMENTS) {
    if (value === s.key) return { segment: s.key, channel: '' }
    if (value.startsWith(`${s.key}-`)) return { segment: s.key, channel: value.slice(s.key.length + 1) }
  }
  return { segment: UNTAGGED, channel: value }
}

export function segmentLabel(key: string): string {
  return SEGMENTS.find((s) => s.key === key)?.label ?? 'Untagged'
}
