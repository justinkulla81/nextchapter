import { PrismaClient } from '@prisma/client'
import { resolveOrgPlace } from './src/lib/crm/org-place'
const p = new PrismaClient()
async function main() {
  const types = ['EMPLOYER','OUTPLACEMENT_LEAD','SEARCH_FIRM']
  await Promise.all(types.map(async (t) => {
    const ids: { id: string }[] = await p.$queryRawUnsafe(`select id from "CrmOrganization" where '${t}'=any("orgTypes") order by random() limit 60`)
    const c: Record<string, number> = {}
    const res = await Promise.all(ids.map(({ id }) => resolveOrgPlace(id)))
    for (const r of res) { const k = r ? (r.fips ? 'county' : 'state only') : 'none'; c[k] = (c[k] ?? 0) + 1 }
    console.log(t, JSON.stringify(c))
  }))
}
main().finally(() => p.$disconnect())
