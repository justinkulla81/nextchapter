import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
p.$queryRawUnsafe(`select id from "ConferenceEvent" where source like 'wave%' and published order by random() limit 20`).then((r: any) => console.log(r.map((x: any) => x.id).join('\n'))).finally(() => p.$disconnect())
