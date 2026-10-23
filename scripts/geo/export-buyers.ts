/**
 * Everything we know about each buyer in one JSON, ready for the spreadsheet builder:
 * workforce boards (+ layoffs in their counties, director, crawl findings, their job centers),
 * EDA districts, local EDOs and state agencies.
 *   npx tsx --env-file=.env.local scripts/geo/export-buyers.ts   ->  data/geo/buyers-export.json
 */
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'node:fs'

const prisma = new PrismaClient()
async function main() {
  const [boards, partners, ajcs, crawls, warn] = await Promise.all([
    prisma.workforceBoard.findMany(),
    prisma.localPartnerOrg.findMany(),
    prisma.americanJobCenter.findMany(),
    prisma.buyerCrawl.findMany(),
    prisma.$queryRaw<{ id: string; notices: number; emp: number; latest: Date | null; employers: string[] }[]>`
      SELECT b.id, count(DISTINCT w.id)::int AS notices, coalesce(sum(w.employees), 0)::int AS emp, max(w."noticeDate") AS latest,
             (array_agg(DISTINCT w.employer))[1:5] AS employers
      FROM "WorkforceBoard" b
      JOIN LATERAL unnest(b.counties) c ON true
      JOIN "WarnNotice" w ON w.state = b.state AND replace(lower(regexp_replace(coalesce(w.county,''), '\\s*(county|parish)$', '', 'i')), ' ', '') = replace(c, ' ', '')
      WHERE w."noticeDate" > now() - interval '365 days'
      GROUP BY b.id`,
  ])
  const crawlBy = new Map(crawls.map((c) => [c.id, c]))
  const warnBy = new Map(warn.map((w) => [w.id, w]))
  const ajcByBoard = new Map<string, typeof ajcs>()
  for (const a of ajcs) if (a.workforceBoardId) ajcByBoard.set(a.workforceBoardId, [...(ajcByBoard.get(a.workforceBoardId) ?? []), a])
  writeFileSync('data/geo/buyers-export.json', JSON.stringify({
    boards: boards.map((b) => ({ ...b, crawl: crawlBy.get(`BOARD-${b.id}`) ?? null, warn: warnBy.get(b.id) ?? null, centers: (ajcByBoard.get(b.id) ?? []).map((a) => ({ name: a.name, type: a.centerType, phone: a.phone, businessEmail: a.businessEmail, generalEmail: a.generalEmail, city: a.city })) })),
    partners: partners.map((p) => ({ ...p, crawl: crawlBy.get(`${p.kind === 'STATE_AGENCY' ? 'STATE' : p.kind === 'EDD' ? 'EDD' : 'EDO'}-${p.id}`) ?? null })),
    ajcs,
  }))
  console.log({ boards: boards.length, partners: partners.length, ajcs: ajcs.length, crawls: crawls.length, boardsWithLayoffs: warn.length })
}
main().finally(() => prisma.$disconnect())
