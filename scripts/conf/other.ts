import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
p.$queryRawUnsafe(`select coalesce(source,'(null)') src, count(*)::int n, min("createdAt") first, max("createdAt") last from "ConferenceEvent" where "createdAt" > now() - interval '3 days' and (source is null or source not like 'wave%') group by 1 order by 2 desc limit 10`).then(console.table).finally(() => p.$disconnect())
