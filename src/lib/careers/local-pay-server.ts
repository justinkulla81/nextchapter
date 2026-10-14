import 'server-only'
import { prisma } from '@/lib/prisma'
import type { AreaCatalog, AreaRef } from '@/lib/careers/area'
import type { PayByLevel, PayInfo, PayLevel } from '@/lib/careers/local-pay'

// Same reasoning as the taxonomy cache: pay changes once a year when someone runs the importer,
// so an hour in memory is plenty and saves reading the area list on every visit.
const TTL_MS = 60 * 60 * 1000
let catalogMemo: { at: number; value: Promise<AreaCatalog> } | null = null
const lookupMemo = new Map<string, { at: number; value: Promise<(socCode: string) => PayByLevel> }>()

async function loadCatalog(): Promise<AreaCatalog> {
  try {
    const rows = await prisma.occupationWage.findMany({
      where: { areaType: { in: ['STATE', 'METRO'] } },
      distinct: ['areaType', 'areaCode'],
      select: { areaType: true, areaCode: true, areaName: true },
    })
    return {
      states: rows.filter((r) => r.areaType === 'STATE').map((r) => ({ code: r.areaCode, name: r.areaName })),
      metros: rows.filter((r) => r.areaType === 'METRO').map((r) => ({ code: r.areaCode, name: r.areaName })),
    }
  } catch (error) {
    // The table may not exist yet, or no state/metro file has been loaded: pay then falls back to national.
    console.error('Local pay areas unavailable:', error)
    return { states: [], metros: [] }
  }
}

/** The metro and state areas we hold pay for. Empty until the state/metro files are loaded. */
export function getAreaCatalog(): Promise<AreaCatalog> {
  const now = Date.now()
  if (!catalogMemo || now - catalogMemo.at > TTL_MS) catalogMemo = { at: now, value: loadCatalog() }
  return catalogMemo.value
}

async function loadLookup(area: AreaRef): Promise<(socCode: string) => PayByLevel> {
  const bySoc6 = new Map<string, PayByLevel>()
  try {
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
  } catch (error) {
    console.error('Local pay unavailable:', error)
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
  const value = loadLookup(area)
  lookupMemo.set(key, { at: now, value })
  return value
}
