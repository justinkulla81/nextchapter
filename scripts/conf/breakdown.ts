import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const q = async (l: string, s: string) => { console.log('## ' + l); console.table(await p.$queryRawUnsafe(s)) }
  await q('totals', `select count(*)::int new_rows, count(*) filter (where published)::int pub, count(*) filter (where "datesConfirmed")::int dated, count(*) filter (where importance=1)::int imp1 from "ConferenceEvent" where source like 'wave%'`)
  await q('industry', `select i industry, count(*)::int n from "ConferenceEvent", unnest(industries) i where source like 'wave%' group by 1 order by 2 desc`)
  await q('state', `select coalesce(state,'(none)') s, count(*)::int n from "ConferenceEvent" where source like 'wave%' group by 1 order by 2 desc`)
  await q('states with <=5 rows now', `select count(*)::int from (select state from "ConferenceEvent" group by 1 having count(*)<=5) x`)
  await q('unpublished new', `select name, "linkStatus" from "ConferenceEvent" where source like 'wave%' and not published`)
}
main().finally(() => p.$disconnect())
