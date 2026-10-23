/**
 * Lists every site worth crawling for procurement, programs and contacts:
 * workforce boards, EDA districts, local economic development groups, state workforce agencies.
 *   npx tsx --env-file=.env.local scripts/geo/export-crawl-targets.ts
 * Writes data/geo/crawl-targets.json.
 */
import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync } from 'node:fs'

const prisma = new PrismaClient()
async function main() {
  const [boards, partners, ajcs] = await Promise.all([
    prisma.workforceBoard.findMany({ select: { id: true, name: true, state: true, website: true, directorName: true, directorEmail: true, statewide: true } }),
    prisma.localPartnerOrg.findMany({ select: { id: true, kind: true, name: true, state: true, website: true, contactName: true, email: true } }),
    prisma.americanJobCenter.count(),
  ])
  const targets = [
    ...boards.filter((b) => b.website).map((b) => ({ kind: 'BOARD', id: b.id, name: b.name, state: b.state, website: b.website!, contactName: b.directorName, email: b.directorEmail })),
    ...partners.filter((p) => p.website).map((p) => ({ kind: p.kind === 'STATE_AGENCY' ? 'STATE' : p.kind === 'EDD' ? 'EDD' : 'EDO', id: p.id, name: p.name, state: p.state, website: p.website!, contactName: p.contactName, email: p.email })),
  ]
  mkdirSync('data/geo', { recursive: true })
  writeFileSync('data/geo/crawl-targets.json', JSON.stringify(targets, null, 1))
  const by: Record<string, number> = {}
  for (const t of targets) by[t.kind] = (by[t.kind] ?? 0) + 1
  console.log(targets.length, by, `AJCs in table: ${ajcs}`)
}
main().finally(() => prisma.$disconnect())
