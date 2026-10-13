// A college's time zone (Admin › Overview): events and office hours are typed
// and shown in it. Defaults from the college's state; US Eastern otherwise.
// Client-safe (no server-only): forms show the zone's short name.

export const US_TIME_ZONES = [
  { key: 'America/New_York', label: 'Eastern' },
  { key: 'America/Chicago', label: 'Central' },
  { key: 'America/Denver', label: 'Mountain' },
  { key: 'America/Phoenix', label: 'Arizona (no daylight saving)' },
  { key: 'America/Los_Angeles', label: 'Pacific' },
  { key: 'America/Anchorage', label: 'Alaska' },
  { key: 'Pacific/Honolulu', label: 'Hawaii' },
] as const

const CENTRAL = ['AL', 'AR', 'IL', 'IA', 'KS', 'LA', 'MN', 'MS', 'MO', 'NE', 'ND', 'OK', 'SD', 'TN', 'TX', 'WI']
const MOUNTAIN = ['CO', 'ID', 'MT', 'NM', 'UT', 'WY']
const PACIFIC = ['CA', 'NV', 'OR', 'WA']

export function defaultTimeZone(state: string | null | undefined): string {
  const s = (state ?? '').toUpperCase()
  if (s === 'AZ') return 'America/Phoenix'
  if (s === 'AK') return 'America/Anchorage'
  if (s === 'HI') return 'Pacific/Honolulu'
  if (CENTRAL.includes(s)) return 'America/Chicago'
  if (MOUNTAIN.includes(s)) return 'America/Denver'
  if (PACIFIC.includes(s)) return 'America/Los_Angeles'
  return 'America/New_York'
}

export function collegeTimeZone(enabledFeatures: unknown, profile: unknown): string {
  const set = (enabledFeatures as { timeZone?: string } | null)?.timeZone
  if (set && US_TIME_ZONES.some((z) => z.key === set)) return set
  const state = (profile as { college?: { state?: string }; region?: { state?: string } } | null)?.college?.state ?? (profile as { region?: { state?: string } } | null)?.region?.state
  return defaultTimeZone(state)
}

export function zoneLabel(tz: string): string {
  return US_TIME_ZONES.find((z) => z.key === tz)?.label.replace(/ \(.*\)/, '') ?? tz
}

// A date and time typed in the college's zone, as an instant.
export function zonedToUtc(date: string, time: string, timeZone: string): Date | null {
  const naive = new Date(`${date}T${time}:00Z`)
  if (Number.isNaN(naive.getTime())) return null
  const offsetAt = (d: Date) => {
    const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(d).find((p) => p.type === 'timeZoneName')?.value ?? 'GMT'
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(name)
    return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0
  }
  // Two passes handle the hour around a daylight-saving change.
  let utc = new Date(naive.getTime() - offsetAt(naive) * 60_000)
  utc = new Date(naive.getTime() - offsetAt(utc) * 60_000)
  return utc
}

export function formatInZone(d: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone }).format(new Date(d))
}
