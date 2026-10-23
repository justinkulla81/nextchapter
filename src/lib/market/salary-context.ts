import 'server-only'
import { resolveArea } from '@/lib/careers/area'
import { getAreaCatalog } from '@/lib/careers/local-pay-server'
import type { AreaCatalog } from '@/lib/careers/area'
import { costsFor } from '@/lib/market/area-costs'
import type { SalaryContext } from '@/lib/market/salary-compare'

/** The member's last salary and home-metro costs, resolved once for a page (never per row). Fails soft to "no home". */
export async function loadSalaryContext(profile: { lastSalary: number | null; currentCity: string | null; currentState: string | null }): Promise<{ ctx: SalaryContext; catalog: AreaCatalog }> {
  const catalog = await getAreaCatalog().catch(() => ({ metros: [], states: [] }) as AreaCatalog)
  const metro = resolveArea({ city: profile.currentCity, state: profile.currentState }, catalog).metro
  const c = metro ? costsFor({ metroCode: metro.code }) : null
  const home = metro && c?.rpp && c.name !== 'United States' ? c : null
  return { ctx: { lastSalary: profile.lastSalary ?? null, home }, catalog }
}
