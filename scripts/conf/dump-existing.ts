import { PrismaClient } from '@prisma/client'
import fs from 'node:fs'
const p = new PrismaClient()
p.conferenceEvent.findMany({ select: { name: true, urlKey: true, organizer: true } }).then((r) => fs.writeFileSync(process.argv[2], r.map((x) => `${x.urlKey}\t${x.name}\t${x.organizer ?? ''}`).join('\n'))).finally(() => p.$disconnect())
