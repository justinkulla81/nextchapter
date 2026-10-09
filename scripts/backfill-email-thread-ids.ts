/**
 * One-off: fills CrmActivity.threadId for synced emails logged before thread
 * ids were stored, so the profile's email chains are exact. Read-only on
 * Gmail (metadata fetch), one UPDATE per message. Safe to re-run.
 *
 *   npx tsx --conditions=react-server scripts/backfill-email-thread-ids.ts
 */
import { prisma } from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/google/connection'
import { getMessageHeaders } from '@/lib/google/gmail'

async function main() {
  const token = await getValidAccessToken()
  if (!token) throw new Error('No connected Gmail account')
  const rows = await prisma.crmActivity.findMany({
    where: { type: 'EMAIL', threadId: null, isAutoLogged: true, sourceRef: { not: null } },
    select: { sourceRef: true },
  })
  // sourceRef is "<gmail message id>:<person id>"; mailing-list rows carry another prefix.
  const ids = [...new Set(rows.map((r) => r.sourceRef!.split(':')[0]).filter((id) => /^[0-9a-f]{12,20}$/.test(id)))]
  console.log(`${ids.length} messages to look up`)
  let done = 0, missing = 0
  for (const id of ids) {
    try {
      const m = await getMessageHeaders(token, id)
      if (!m) { missing++; continue }
      await prisma.crmActivity.updateMany({ where: { type: 'EMAIL', sourceRef: { startsWith: `${id}:` }, threadId: null }, data: { threadId: m.threadId } })
      done++
    } catch (e) {
      console.error('failed', id, e instanceof Error ? e.message : e)
    }
    if (done % 100 === 0 && done > 0) console.log(`${done}/${ids.length}`)
  }
  console.log(`Done: ${done} filled, ${missing} no longer in Gmail`)
}
main().finally(() => prisma.$disconnect())
