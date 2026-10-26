import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  for (const t of ['EventsCatalogSeed','LocalEvent','CollegeEvent','CareerEvent','ConferenceEdition','ConferenceEmployer','ConferenceSpeaker','ConferenceExtraction'])
    console.log(t, (await p.$queryRawUnsafe(`select count(*)::int n from "${t}"`) as any)[0].n)
  console.table(await p.$queryRawUnsafe(`select * from "EventsCatalogSeed" limit 2`))
  console.table(await p.$queryRawUnsafe(`select "linkStatus", count(*)::int n from "ConferenceEvent" group by 1`))
  console.table(await p.$queryRawUnsafe(`select count(*) filter (where "startDate" > now())::int upcoming, count(*) filter (where "startDate" < now())::int past from "ConferenceEvent"`))
}
main().finally(() => p.$disconnect())
