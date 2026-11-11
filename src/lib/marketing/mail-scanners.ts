import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { memoTtl } from '@/lib/db/heavy'
import { isDatacenterIp } from '@/lib/http/datacenter-ip'

// A mail-security scanner (Microsoft, Proofpoint and the like) opens every link in every message it screens, for every
// company that hosts its mail with it. So one IP shows up for dozens of unrelated recipients. A person does not: an address
// that opened the links in emails to this many different people is a scanner, whatever country the lookup puts it in.
export const SCANNER_MIN_PEOPLE = 3
const LOOKBACK_DAYS = 14

/**
 * IPs that opened the unsubscribe link of SCANNER_MIN_PEOPLE or more different recipients in the last two weeks.
 * One grouped statement over two weeks of unsubscribe-link visits, returning only the addresses; held for ten minutes on
 * each instance so the visitor log does not repeat it on every page view.
 */
export const loadScannerIps = memoTtl(10 * 60 * 1000, () => 'scanner-ips', async (): Promise<Set<string>> => {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
  const rows = await prisma.$queryRaw<{ ip: string }[]>(Prisma.sql`
    SELECT "ip" FROM "HomepageVisitEvent"
    WHERE "createdAt" >= ${since} AND "ip" IS NOT NULL AND "path" LIKE '/updates/unsubscribe/%'
    GROUP BY "ip"
    HAVING count(DISTINCT substring("path" from '^/updates/unsubscribe/([A-Za-z0-9_-]+)')) >= ${SCANNER_MIN_PEOPLE}`)
  return new Set(rows.map((r) => r.ip))
})

/** True for an address that is a mail scanner: seen opening many recipients' links, or inside a known cloud network. */
export function isMailScanner(ip: string | null, scanners: Set<string>): boolean {
  return !!ip && (scanners.has(ip) || isDatacenterIp(ip))
}
