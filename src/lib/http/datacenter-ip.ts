// Visits from cloud networks are scanners and automated browsers (email link checkers, AI agents), not people.
// The user-agent check cannot see them: they send a normal Chrome string. Each range below was looked up in the
// public registries (ARIN / RIPE whois) on 2026-10-29 and 2026-10-30 after the visitors page showed the same page path coming
// from consecutive addresses in these blocks. Add a range here when a new block shows up the same way.
const DATACENTER_CIDRS = [
  '74.176.0.0/14', // Microsoft (ARIN NetName MSFT)
  '72.152.0.0/14', // Microsoft (ARIN NetName MSFT)
  '51.54.0.0/15', // Microsoft Limited (RIPE UK-Microsoft, 51.54.0.0 - 51.59.255.255)
  '51.56.0.0/14',
  '135.232.0.0/14', // Azure East US (RIPE netname "cloud")
  '62.10.0.0/16', // RIPE netname "cloud", country US
  '34.16.0.0/12', // Google LLC (ARIN GOOGL-2), Google Cloud
  '34.32.0.0/11', // Google LLC (ARIN GOOGL-2)
  '34.64.0.0/10', // Google LLC (ARIN GOOGL-2); Council Bluffs, Iowa
  '172.252.0.0/16', // Subnet Digital LLC (ARIN EGNL-1), a hosting provider (geofeed at egihosting.com); opened outreach pages in sequence
  '9.169.0.0/17', // RIPE netname "cloud", country US; Boydton, Virginia
  '18.32.0.0/11', // Amazon Technologies (ARIN AT-88-Z), AWS
  '18.64.0.0/10',
  '18.128.0.0/9',
]

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null
    const v = Number(p)
    if (v > 255) return null
    n = n * 256 + v
  }
  return n
}

const RANGES = DATACENTER_CIDRS.map((cidr) => {
  const [base, bits] = cidr.split('/')
  const start = ipv4ToInt(base) as number
  return { start, end: start + 2 ** (32 - Number(bits)) - 1 }
})

export function isDatacenterIp(ip: string | null | undefined): boolean {
  if (!ip) return false
  const n = ipv4ToInt(ip.trim())
  if (n === null) return false
  return RANGES.some((r) => n >= r.start && n <= r.end)
}
