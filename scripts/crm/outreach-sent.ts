/** Writes "email,date" for every first cold email already sent, for the calendar planner (SENT_FILE). */
import { writeFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'

async function main() {
  const out = process.argv[2]
  if (!out) { console.log('usage: outreach-sent.ts <out.txt>'); return }
  const acts = await prisma.crmActivity.findMany({ where: { type: 'EMAIL', direction: 'OUTBOUND', outcome: { startsWith: 'Cold outreach, email 1' }, personId: { not: null } }, select: { occurredAt: true, person: { select: { email: true } } } })
  const lines = acts.filter((a) => a.person?.email).map((a) => `${a.person!.email!.toLowerCase()},${a.occurredAt.toISOString().slice(0, 10)}`)
  writeFileSync(out, lines.join('\n') + '\n')
  console.log(`${lines.length} sent first emails written to ${out}`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
