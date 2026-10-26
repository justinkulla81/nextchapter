import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const q = async (label: string, sql: string) => { console.log('\n## ' + label); console.table(await p.$queryRawUnsafe(sql)) }
  await q('totals', `select count(*)::int total, count(*) filter (where published)::int published, count(*) filter (where verified)::int verified, count(*) filter (where "rejectedAt" is not null)::int rejected, count(*) filter (where "datesConfirmed")::int dated, count(*) filter (where url is null)::int no_url, count(*) filter (where "linkStatus"='OK')::int link_ok, count(*) filter (where "addedBy" is not null)::int member_added from "ConferenceEvent"`)
  await q('kind', `select kind, count(*)::int n from "ConferenceEvent" group by 1 order by 2 desc`)
  await q('source', `select coalesce(source,'(null)') source, count(*)::int n from "ConferenceEvent" group by 1 order by 2 desc limit 15`)
  await q('importance', `select importance, count(*)::int n from "ConferenceEvent" group by 1 order by 1`)
  await q('industry', `select i industry, count(*)::int n from "ConferenceEvent", unnest(industries) i group by 1 order by 2 desc`)
  await q('no industry', `select count(*)::int n from "ConferenceEvent" where cardinality(industries)=0`)
  await q('state', `select coalesce(state,'(none)') state, count(*)::int n from "ConferenceEvent" group by 1 order by 2 desc limit 60`)
  await q('month', `select coalesce("typicalMonth", to_char("startDate",'FMMonth'),'(none)') m, count(*)::int n from "ConferenceEvent" group by 1 order by 2 desc`)
  await q('format', `select format, count(*)::int n from "ConferenceEvent" group by 1`)
  await q('organizer top', `select organizer, count(*)::int n from "ConferenceEvent" where organizer is not null group by 1 order by 2 desc limit 15`)
  await q('distinct organizers', `select count(distinct organizer)::int n from "ConferenceEvent"`)
}
main().finally(() => p.$disconnect())
