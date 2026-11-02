import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  console.table(await p.$queryRawUnsafe(`select id,name,organizer,url,"urlKey",source,importance,"createdAt" from "ConferenceEvent" where id like 'bullhorn-engage%'`))
  console.table(await p.$queryRawUnsafe(`select count(*)::int total, count(*) filter (where source like 'wave%')::int mine from "ConferenceEvent"`))
  console.table(await p.$queryRawUnsafe(`select coalesce(source,'(null)') src, count(*)::int n, count(*) filter (where published)::int pub, count(*) filter (where verified)::int ver, count(*) filter (where "linkStatus"='OK')::int linkok, min("createdAt")::text first, max("createdAt")::text last from "ConferenceEvent" where source is null or source not like 'wave%' and "createdAt" > '2026-10-26T20:00:00Z' group by 1 order by 2 desc limit 12`))
}
main().finally(() => p.$disconnect())
