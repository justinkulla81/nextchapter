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

export const SCANNER_BLOCK_MIN_RECIPIENTS = 2

/**
 * Network blocks (an IPv4 /24, or the first three groups of an IPv6 address) from which list-email links were clicked for two or
 * more different recipients in the last two weeks. A person's own network does not click other people's email; a scanner farm
 * does, from a different address each time. One grouped statement over the click table (a few hundred rows), held ten minutes.
 */
export const loadScannerBlocks = memoTtl(10 * 60 * 1000, () => 'scanner-blocks', async (): Promise<Set<string>> => {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
  const rows = await prisma.$queryRaw<{ block: string }[]>(Prisma.sql`
    SELECT CASE WHEN "ip" LIKE '%:%' THEN split_part("ip", ':', 1) || ':' || split_part("ip", ':', 2) || ':' || split_part("ip", ':', 3)
                ELSE split_part("ip", '.', 1) || '.' || split_part("ip", '.', 2) || '.' || split_part("ip", '.', 3) END AS "block"
    FROM "MailingClickEvent"
    WHERE "clickedAt" >= ${since} AND "ip" IS NOT NULL
    GROUP BY 1
    HAVING count(DISTINCT "recipientId") >= ${SCANNER_BLOCK_MIN_RECIPIENTS}`)
  return new Set(rows.map((r) => r.block))
})
