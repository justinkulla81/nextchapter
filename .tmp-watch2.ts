import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
async function main() {
  const since = new Date('2026-10-23T02:30:00Z')
  for (let i = 0; i < 70; i++) {
    const r = await p.crmSyncRun.findMany({ where: { startedAt: { gt: since }, source: 'gmail', finishedAt: { not: null } }, take: 1 })
    if (r.length) { console.log(`RESULT gmail ${r[0].startedAt.toISOString()} scanned ${r[0].scanned} created ${r[0].activitiesCreated} ${r[0].error ?? 'ok'}`); break }
    await new Promise((res) => setTimeout(res, 60000))
  }
  console.log('DONE')
}
main().finally(() => p.$disconnect())
