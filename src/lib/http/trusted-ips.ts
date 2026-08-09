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

// Local dev traffic (running the app on your own machine) resolves to the
// loopback address, never a real visitor — always excluded, unlike
// isTrustedOwnerIp above which depends on an env var being kept current.
const LOOPBACK_IPS = new Set(['::1', '127.0.0.1', '::ffff:127.0.0.1'])

export function isLoopbackIp(ip: string | null): boolean {
  if (!ip) return false
  return LOOPBACK_IPS.has(ip)
}
