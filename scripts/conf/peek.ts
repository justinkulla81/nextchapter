import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
p.conferenceEvent.findMany({ where: { importance: 3, published: true }, take: 2 }).then((r) => console.log(JSON.stringify(r, null, 1))).finally(() => p.$disconnect())
