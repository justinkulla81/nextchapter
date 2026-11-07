// The paid channels the Visitor activity card follows, for both spend (typed in) and leads (read from tagged visits).

export const PAID_CHANNELS = [
  { key: 'google', label: 'Google Ads', color: 'var(--color-brand)' },
  { key: 'linkedin', label: 'LinkedIn', color: 'var(--color-navy)' },
  { key: 'reddit', label: 'Reddit', color: 'var(--color-warning)' },
  { key: 'facebook', label: 'Facebook', color: 'var(--color-success)' },
  { key: 'bing', label: 'Bing', color: 'var(--color-light-blue)' },
] as const

export type PaidChannel = (typeof PAID_CHANNELS)[number]['key']

export const isPaidChannel = (value: string): value is PaidChannel => PAID_CHANNELS.some((c) => c.key === value)
export const paidChannelLabel = (key: string) => PAID_CHANNELS.find((c) => c.key === key)?.label ?? key

// A visit is a paid click only when the ad network's own click id is there (gclid, msclkid) or the link was tagged with a paid
// medium. Facebook and LinkedIn put click ids on organic shares too, so for them only the paid tag counts.
const PAID_MEDIUM = /^(cpc|ppc|paid.*)$/i
const SOURCE_CHANNEL: Record<string, PaidChannel> = {
  google: 'google',
  bing: 'bing',
  microsoft: 'bing',
  reddit: 'reddit',
  linkedin: 'linkedin',
  facebook: 'facebook',
  fb: 'facebook',
  meta: 'facebook',
  instagram: 'facebook',
  ig: 'facebook',
}

/** The ad channel a landing path came from, or null when it is not a paid click we can place. */
export function classifyPaidChannel(path: string | null): PaidChannel | null {
  if (!path) return null
  const query = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?') + 1).split('#')[0] : '')
  if (query.has('gclid') || query.has('gbraid') || query.has('wbraid')) return 'google'
  if (query.has('msclkid')) return 'bing'
  const medium = query.get('utm_medium') ?? ''
  if (!PAID_MEDIUM.test(medium)) return null
  const source = (query.get('utm_source') ?? '').toLowerCase()
  if (SOURCE_CHANNEL[source]) return SOURCE_CHANNEL[source]
  // An untagged-source paid search click has always counted as Google here.
  return source === '' && /^(cpc|ppc)$/i.test(medium) ? 'google' : null
}

/** The utm_campaign value of a landing path, or null. */
export function campaignOfPath(path: string | null): string | null {
  if (!path || !path.includes('?')) return null
  return new URLSearchParams(path.slice(path.indexOf('?') + 1).split('#')[0]).get('utm_campaign')
}
