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

export const BOT_CLICK_BLOCK_MIN_IPS = 3

/**
 * Where the visitor log should look for scanners that visit the page after clicking: every address that made a click flagged bot
 * in the last two weeks, and every IPv4 /24 (as "a.b.c" prefixes) with three or more such addresses (a scanner farm clicks from a
 * different address each time, e.g. 103.196.9.x). One grouped statement over the click table (about 700 rows, 190 bot addresses in
 * 14 days), held ten minutes on each instance.
 */
export const loadBotClickNetworks = memoTtl(10 * 60 * 1000, () => 'bot-click-networks', async (): Promise<{ ips: Set<string>; blocks: Set<string> }> => {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
  const rows = await prisma.$queryRaw<{ ip: string }[]>(Prisma.sql`
    SELECT DISTINCT "ip" FROM "MailingClickEvent" WHERE "bot" = true AND "clickedAt" >= ${since} AND "ip" IS NOT NULL AND "ip" <> ''`)
  const ips = new Set(rows.map((r) => r.ip))
  const perBlock = new Map<string, number>()
  for (const ip of ips) {
    if (ip.includes(':')) continue
    const block = ip.split('.').slice(0, 3).join('.')
    perBlock.set(block, (perBlock.get(block) ?? 0) + 1)
  }
  const blocks = new Set(Array.from(perBlock).filter(([, n]) => n >= BOT_CLICK_BLOCK_MIN_IPS).map(([b]) => b))
  return { ips, blocks }
})

export const SCANNER_BLOCK_MIN_RECIPIENTS = 2

/**
 * Network blocks (an IPv4 /24, or the first three groups of an IPv6 address) from which list-email links were clicked for two or
 * more different recipients in the last two weeks. A person's own network does not click other people's email; a scanner farm
 * does, from a different address each time. One grouped statement over the click table (a few hundred rows), held ten minutes.
 */
export const loadScannerBlocks = memoTtl(10 * 60 * 1000, () => 'scanner-blocks', async (): Promise<Set<string>> => {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
  const rows = await prisma.$queryRaw<{ block: string }[]>(Prisma.sql`
    SELECT "block" FROM (
      SELECT CASE WHEN "ip" LIKE '%:%' THEN split_part("ip", ':', 1) || ':' || split_part("ip", ':', 2) || ':' || split_part("ip", ':', 3)
                  ELSE split_part("ip", '.', 1) || '.' || split_part("ip", '.', 2) || '.' || split_part("ip", '.', 3) END AS "block",
             "recipientId"
      FROM "MailingClickEvent" WHERE "clickedAt" >= ${since} AND "ip" IS NOT NULL
      UNION ALL
      SELECT CASE WHEN "ip" LIKE '%:%' THEN split_part("ip", ':', 1) || ':' || split_part("ip", ':', 2) || ':' || split_part("ip", ':', 3)
                  ELSE split_part("ip", '.', 1) || '.' || split_part("ip", '.', 2) || '.' || split_part("ip", '.', 3) END AS "block",
             "recipientId"
      FROM "MailingOpenEvent" WHERE "openedAt" >= ${since} AND "ip" <> ''
    ) t
    GROUP BY "block"
    HAVING count(DISTINCT "recipientId") >= ${SCANNER_BLOCK_MIN_RECIPIENTS}`)
  return new Set(rows.map((r) => r.block))
})
