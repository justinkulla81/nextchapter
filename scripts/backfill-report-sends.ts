// Records who got a Displacement Report by hand, for any edition.
//
// Scans outbound Gmail activity the CRM sync logged since --since (default
// 2026-09-01) for emails you sent with a displacement-report-*.pdf
// attachment or a launchyournextchapter.com/reports/... link, reads the
// edition (YYYY-MM) off the attachment name or link, and records each
// person as MANUAL for that edition so later editions' "already sent"
// filter leaves them out. Never creates a person; never downgrades a row
// the system sent.
//
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/backfill-report-sends.ts --dry-run [--since=2026-09-01]
//      NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/backfill-report-sends.ts [--since=2026-09-01]

import { prisma } from '../src/lib/prisma'
import { getValidAccessToken } from '../src/lib/google/connection'
import { getMessageContent } from '../src/lib/google/gmail'
import { detectReportEdition } from '../src/lib/mailing/edition-parser'
import { markReportManual } from '../src/lib/mailing/tracking'

const DRY = process.argv.includes('--dry-run')
const sinceArg = process.argv.find((a) => a.startsWith('--since='))?.slice('--since='.length)
const SINCE = new Date(`${sinceArg ?? '2026-09-01'}T00:00:00Z`)

async function main() {
  console.log(`${DRY ? '[dry run] ' : ''}Scanning email sent since ${SINCE.toISOString().slice(0, 10)} for report sends\n`)
  const token = await getValidAccessToken()
  if (!token) console.log('No Gmail connection — checking stored bodies only, not attachments.\n')

  const activities = await prisma.crmActivity.findMany({
    where: { type: 'EMAIL', direction: 'OUTBOUND', occurredAt: { gte: SINCE }, personId: { not: null }, person: { deletedAt: null } },
    orderBy: { occurredAt: 'asc' },
    select: { id: true, personId: true, occurredAt: true, subject: true, body: true, sourceRef: true, person: { select: { fullName: true } } },
  })
  console.log(`${activities.length} outbound emails to check.`)

  // One Gmail fetch per message, however many people were on it.
  const content = new Map<string, string[]>()
  // personId + edition → earliest matching email
  const found = new Map<string, { personId: string; edition: string; activityId: string; at: Date; subject: string | null; via: string; name: string }>()
  for (const a of activities) {
    const messageId = a.sourceRef?.split(':')[0]
    let names: string[] = []
    if (token && messageId) {
      if (!content.has(messageId)) content.set(messageId, (await getMessageContent(token, messageId, 2000)).attachmentNames)
      names = content.get(messageId)!
    }
    const edition = detectReportEdition({ attachmentNames: names, body: a.body })
    if (!edition) continue
    const key = `${a.personId}:${edition}`
    if (found.has(key)) continue
    const att = names.find((n) => /displacement-report/i.test(n))
    found.set(key, { personId: a.personId!, edition, activityId: a.id, at: a.occurredAt, subject: a.subject, via: att ? `attachment ${att}` : 'report link', name: a.person!.fullName })
  }

  const byEdition = new Map<string, typeof found extends Map<string, infer V> ? V[] : never>()
  for (const f of found.values()) byEdition.set(f.edition, [...(byEdition.get(f.edition) ?? []), f])
  for (const [edition, rows] of [...byEdition].sort()) {
    console.log(`\nEdition ${edition} (${rows.length}):`)
    for (const f of rows) console.log(`  ✋ ${f.name} — ${f.at.toISOString().slice(0, 10)}, ${f.via}, "${f.subject ?? ''}"`)
  }

  if (DRY) {
    console.log(`\n[dry run] Would mark ${found.size} person/edition pairs. Nothing written.`)
    return
  }
  let created = 0, updated = 0, kept = 0
  for (const f of found.values()) {
    const r = await markReportManual({ personId: f.personId, editionKey: f.edition, channel: 'EMAIL', sentAt: f.at, activityId: f.activityId, subject: f.subject, markedByEmail: 'backfill-report-sends' })
    if (r === 'created') created++; else if (r === 'updated') updated++; else kept++
  }
  console.log(`\nDone: ${created} created, ${updated} updated, ${kept} left as automated.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
