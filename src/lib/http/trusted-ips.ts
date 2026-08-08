import 'server-only'

// The site owner's own devices — set via TRUSTED_OWNER_IPS (comma-separated)
// in env config. Visits from these IPs are never recorded at all, so they
// can't show up in the visitor page or the daily digest even by accident.
// Note: this is IP-based, so it only works as long as the owner's IP stays
// stable — a new home/mobile IP needs to be added to the env var again.
export function isTrustedOwnerIp(ip: string | null): boolean {
  if (!ip) return false
  const trusted = (process.env.TRUSTED_OWNER_IPS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return trusted.includes(ip)
}
