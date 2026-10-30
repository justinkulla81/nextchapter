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
  { key: 'b2b-boards', label: 'B2B: workforce boards and WIOA' },
  { key: 'b2b-employers', label: 'B2B: employers and CHROs' },
  { key: 'b2b-outplacement', label: 'B2B: outplacement and career transition' },
  { key: 'b2b-highered', label: 'B2B: higher education and alumni services' },
] as const

export const UNTAGGED = 'untagged'

const SITE = 'https://launchyournextchapter.com'

/** Pages that load today and are used as landing pages. */
export const LANDING_PAGES = [
  { path: '/layoffs', label: 'Layoffs' },
  { path: '/why-stuck', label: 'Why stuck' },
  { path: '/how-it-works', label: 'How it works' },
  { path: '/ai-training', label: 'AI training' },
  { path: '/jobs', label: 'Jobs' },
  { path: '/funding', label: 'Funding' },
  { path: '/unemployment-benefits', label: 'Unemployment benefits' },
  { path: '/reports', label: 'Reports' },
  { path: '/workforce-boards', label: 'Workforce boards' },
  { path: '/outplacement', label: 'Outplacement' },
  { path: '/higher-education', label: 'Higher education' },
  { path: '/for-organizations', label: 'For organizations' },
] as const

/** The landing page each segment points to unless you pick another. */
export const DEFAULT_LANDING: Record<string, string> = {
  'laid-off-recent': '/layoffs',
  'laid-off-long': '/why-stuck',
  'career-change': '/how-it-works',
  returner: '/how-it-works',
  senior: '/how-it-works',
  'ai-retraining': '/ai-training',
  'b2b-boards': '/workforce-boards',
  'b2b-employers': '/outplacement',
  'b2b-outplacement': '/outplacement',
  'b2b-highered': '/higher-education',
}

/** `named` channels need a name (a partner, community or newsletter) that becomes part of the tag. */
export const CHANNELS = [
  { key: 'google', label: 'Google Search', source: 'google', medium: 'cpc', named: false, term: true },
  { key: 'facebook', label: 'Facebook ads', source: 'facebook', medium: 'paid_social', named: false, term: false },
  { key: 'linkedin-ads', label: 'LinkedIn ads', source: 'linkedin', medium: 'paid_social', named: false, term: false },
  { key: 'linkedin-post', label: 'LinkedIn post', source: 'linkedin', medium: 'social', named: false, term: false },
  { key: 'partner', label: 'A partner', source: '', medium: 'referral', named: true, term: false },
  { key: 'community', label: 'A community', source: '', medium: 'social', named: true, term: false },
  { key: 'newsletter', label: 'A newsletter', source: '', medium: 'newsletter', named: true, term: false },
] as const

export type ChannelKey = (typeof CHANNELS)[number]['key']

export function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export interface TaggedLinkInput {
  segment: string
  channel: ChannelKey
  landing: string
  /** The partner, community or newsletter, for the channels that need one. */
  name?: string
}

/**
 * Builds a link whose utm_campaign is "<segment>-<channel>", with the partner, community or newsletter name
 * appended for named channels. Returns null when a named channel has no usable name or the segment is unknown.
 */
export function buildTaggedLink({ segment, channel, landing, name }: TaggedLinkInput): string | null {
  const seg = SEGMENTS.find((s) => s.key === segment)
  const ch = CHANNELS.find((c) => c.key === channel)
  if (!seg || !ch || !landing.startsWith('/')) return null
  const slug = slugify(name ?? '')
  if (ch.named && !slug) return null
  const source = ch.named ? slug : ch.source
  const campaign = ch.named ? `${seg.key}-${ch.key}-${slug}` : `${seg.key}-${ch.key}`
  const query = `utm_source=${source}&utm_medium=${ch.medium}&utm_campaign=${campaign}${ch.term ? '&utm_term={keyword}' : ''}`
  return `${SITE}${landing}?${query}`
}

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
