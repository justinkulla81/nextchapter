import 'server-only'
import { prisma } from '@/lib/prisma'
import type { AreaCatalog, AreaRef } from '@/lib/careers/area'
import type { PayByLevel, PayInfo, PayLevel } from '@/lib/careers/local-pay'

// Same reasoning as the taxonomy cache: pay changes once a year when someone runs the importer,
// so an hour in memory is plenty and saves reading the area list on every visit.
const TTL_MS = 60 * 60 * 1000
const MAX_LOOKUPS = 100
let catalogMemo: { at: number; value: Promise<AreaCatalog> } | null = null
const lookupMemo = new Map<string, { at: number; value: Promise<(socCode: string) => PayByLevel> }>()

// Throws on a database error so the caller can avoid remembering the failure for an hour.
async function loadCatalog(): Promise<AreaCatalog> {
  const rows = await prisma.occupationWage.findMany({
    where: { areaType: { in: ['STATE', 'METRO'] } },
    distinct: ['areaType', 'areaCode'],
    select: { areaType: true, areaCode: true, areaName: true },
  })
  return {
    states: rows.filter((r) => r.areaType === 'STATE').map((r) => ({ code: r.areaCode, name: r.areaName })),
    metros: rows.filter((r) => r.areaType === 'METRO').map((r) => ({ code: r.areaCode, name: r.areaName })),
  }
}

/** The metro and state areas we hold pay for. Empty until the state/metro files are loaded. */
export function getAreaCatalog(): Promise<AreaCatalog> {
  const now = Date.now()
  if (!catalogMemo || now - catalogMemo.at > TTL_MS) {
    const at = now
    // A failed load (for example the table does not exist yet) yields no areas for this request only; it is not remembered.
    const value = loadCatalog().catch((error) => {
      console.error('Local pay areas unavailable:', error)
      if (catalogMemo?.at === at) catalogMemo = null
      return { states: [], metros: [] } as AreaCatalog
    })
    catalogMemo = { at, value }
  }
  return catalogMemo.value
}

// Throws on a database error so the caller can avoid remembering the failure for an hour.
async function loadLookup(area: AreaRef): Promise<(socCode: string) => PayByLevel> {
  const bySoc6 = new Map<string, PayByLevel>()
  const rows = await prisma.occupationWage.findMany({
    where: {
      OR: [
        { areaType: 'NATIONAL' },
        ...(area.state ? [{ areaType: 'STATE', areaCode: area.state.code }] : []),
        ...(area.metro ? [{ areaType: 'METRO', areaCode: area.metro.code }] : []),
      ],
    },
  })
  for (const r of rows) {
    const level = r.areaType as PayLevel
    const info: PayInfo = {
      level,
      areaName: r.areaName,
      median: r.wageMedian,
      p10: r.wageP10,
      p25: r.wageP25,
      p75: r.wageP75,
      p90: r.wageP90,
      employment: r.employment,
      ceilingHit: r.ceilingHit,
    }
    bySoc6.set(r.soc6, { ...(bySoc6.get(r.soc6) ?? {}), [level]: info })
  }
  // O*NET-SOC "13-2011.00" shares its pay with every code that starts "13-2011".
  return (socCode) => bySoc6.get(socCode.slice(0, 7)) ?? {}
}

/** Pay by place for every occupation, for one person's metro and state. */
export function getPayLookup(area: AreaRef): Promise<(socCode: string) => PayByLevel> {
  const key = `${area.metro?.code ?? '-'}|${area.state?.code ?? '-'}`
  const now = Date.now()
  const hit = lookupMemo.get(key)
  if (hit && now - hit.at <= TTL_MS) return hit.value
  // One entry per distinct metro and state pair: drop the oldest when the map grows.
  if (lookupMemo.size >= MAX_LOOKUPS) lookupMemo.delete(lookupMemo.keys().next().value as string)
  const value = loadLookup(area).catch((error) => {
    console.error('Local pay unavailable:', error)
    lookupMemo.delete(key)
    return (() => ({})) as (socCode: string) => PayByLevel
  })
  lookupMemo.set(key, { at: now, value })
  return value
}
