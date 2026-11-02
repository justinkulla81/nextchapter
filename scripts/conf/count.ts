import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
p.$queryRawUnsafe(`select count(*)::int total, count(*) filter (where source like 'wave%')::int new_rows, count(*) filter (where source like 'wave%' and published)::int new_pub from "ConferenceEvent"`).then(console.table).finally(() => p.$disconnect())
