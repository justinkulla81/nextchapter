// Coverage audit of the WIOA board directory: every county must sit in exactly
// one local board (town/place-based states are checked by place lists).
//   npx tsx scripts/geo/audit-boards.ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { countyKey } from '../../src/lib/workforce/places'
const prisma = new PrismaClient()
async function main() {
  const boards = await prisma.workforceBoard.findMany()
  const areas = await prisma.geoArea.findMany({ where: { level: 'COUNTY' }, select: { state: true, name: true } })
  const byState = new Map<string, string[]>()
  for (const a of areas) (byState.get(a.state) ?? byState.set(a.state, []).get(a.state)!).push(a.name)
  const states = [...new Set(boards.map((b) => b.state))].sort()
  const statewide = boards.filter((b) => b.statewide)
  console.log('statewide per state:', Object.fromEntries(states.map((s) => [s, statewide.filter((b) => b.state === s).length])))
  for (const st of states) {
    const local = boards.filter((b) => b.state === st && !b.statewide)
    const all = (byState.get(st) ?? []).map((n) => countyKey(n))
    const cov = new Map<string, string[]>()
    for (const b of local) for (const c of b.counties) (cov.get(c) ?? cov.set(c, []).get(c)!).push(b.name)
    const uncovered = all.filter((c) => !cov.has(c))
    const dupes = [...cov].filter(([, v]) => v.length > 1).map(([c, v]) => `${c}:${v.join('|')}`)
    const unknown = [...cov.keys()].filter((c) => !all.includes(c))
    const placeBased = local.some((b) => /^(towns?|cities|city):/i.test(b.serviceArea ?? ''))
    console.log(`${st} local=${local.length} counties=${all.length} uncovered=${uncovered.length}${placeBased ? ' (place-based)' : ''} dupes=${dupes.length} unknownCounty=${unknown.length}`)
    if (uncovered.length && uncovered.length < 15) console.log('   uncovered:', uncovered.join(', '))
    if (dupes.length) console.log('   dupes:', dupes.slice(0, 5).join(' ; '))
    if (unknown.length) console.log('   unknown:', unknown.slice(0, 8).join(', '))
  }
}
main().finally(() => prisma.$disconnect())
