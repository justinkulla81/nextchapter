// Visits from cloud networks are scanners and automated browsers (email link checkers, AI agents), not people.
// The user-agent check cannot see them: they send a normal Chrome string. Each range below was looked up in the
// public registries (ARIN / RIPE whois) on 2026-10-29 and 2026-10-30 after the visitors page showed the same page path coming
// from consecutive addresses in these blocks. Add a range here when a new block shows up the same way.
export const DATACENTER_CIDRS = [
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
  // Looked up in ARIN / RIPE RDAP on 2026-11-11 after the visitors page showed them as Human.
  '48.209.0.0/16', // RIPE netname "cloud", MICROSOFT-MAINT; opened the unsubscribe link then the report within a second
  '48.210.0.0/16', // same
  '128.85.0.0/17', // same
  '173.252.64.0/18', // Facebook (ARIN FACEBOOK-INC): the link-preview crawler, one hit per address
  '69.63.176.0/20', // Facebook (ARIN TFBNET2)
  '69.171.224.0/19', // Facebook (ARIN TFBNET3)
  '66.220.144.0/20', // Facebook (ARIN TFBNET3)
  '54.64.0.0/11', // Amazon (ARIN AMAZON-2011L), EC2
  '54.144.0.0/12', // Amazon (ARIN AMAZON), EC2
  '54.160.0.0/11', // Amazon (ARIN AMAZON), EC2
  '13.216.0.0/13', // Amazon (ARIN AMAZON-IAD), EC2
  // ARIN RDAP, 2026-11-12: AWS us-west-2 (Boardman, Oregon). Report-page visits came in pairs seconds apart, a Windows then a phone user agent.
  '35.80.0.0/12', // Amazon (ARIN AMAZON-ZPDX)
  '44.224.0.0/11', // Amazon (ARIN AMAZO-ZPDX)
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
