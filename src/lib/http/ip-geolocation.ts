import 'server-only'

interface IpLocation {
  city: string | null
  region: string | null
  country: string | null
}

// ip-api.com's free tier — no API key, ~45 requests/minute, plenty for a
// once-a-day digest that only looks up a handful of unique IPs. HTTP only
// (no HTTPS on the free tier), which is fine for a server-to-server call.
export async function lookupIpLocation(ip: string): Promise<IpLocation | null> {
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.status !== 'success') return null
    return {
      city: data.city || null,
      region: data.regionName || null,
      country: data.country || null,
    }
  } catch (error) {
    console.error('Failed to look up IP location for', ip, error)
    return null
  }
}

export function formatIpLocation(location: IpLocation | null): string | null {
  if (!location) return null
  const parts = [location.city, location.region, location.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : null
}
