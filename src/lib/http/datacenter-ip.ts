// Visits from cloud networks are scanners and automated browsers (email link checkers, AI agents), not people.
// The user-agent check cannot see them: they send a normal Chrome string. Each range below was looked up in the
// public registries (ARIN / RIPE whois) on 2026-10-29 after the visitors page showed the same page path coming
// from consecutive addresses in these blocks. Add a range here when a new block shows up the same way.
const DATACENTER_CIDRS = [
  '74.176.0.0/14', // Microsoft (ARIN NetName MSFT)
  '72.152.0.0/14', // Microsoft (ARIN NetName MSFT)
  '51.54.0.0/15', // Microsoft Limited (RIPE UK-Microsoft, 51.54.0.0 - 51.59.255.255)
  '51.56.0.0/14',
  '135.232.0.0/14', // Azure East US (RIPE netname "cloud")
  '62.10.0.0/16', // RIPE netname "cloud", country US
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
