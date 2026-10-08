// Marks who received the September 2026 Displacement Report by hand.
//
// Scans Gmail activity the CRM sync logged since 2026-10-01 — emails you
// sent with a displacement-report-*.pdf attachment or a
// launchyournextchapter.com/reports/... link — and records each person as
// MANUAL for edition 2026-09. Taylor Stockton, Grant Trahant, Allen Geller
// and Jason Wendle are always included if they exist (matched on email,
// then on full name). Never creates a person; never downgrades a row the
// system sent.
//
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/backfill-report-sends-2026-09.ts --dry-run
//      NODE_OPTIONS="--conditions=react-server" npx tsx --env-file=.env.local scripts/backfill-report-sends-2026-09.ts

import { prisma } from '../src/lib/prisma'
import { getValidAccessToken } from '../src/lib/google/connection'
import { getMessageContent } from '../src/lib/google/gmail'
import { detectReportEdition } from '../src/lib/mailing/edition-parser'
import { markReportManual } from '../src/lib/mailing/tracking'

const EDITION = '2026-09'
const SINCE = new Date('2026-10-01T00:00:00Z')
const DRY = process.argv.includes('--dry-run')
const ALWAYS: { name: string; email?: string }[] = [
  { name: 'Taylor Stockton' },
  { name: 'Grant Trahant' },
  { name: 'Allen Geller' },
  { name: 'Jason Wendle' },
]

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

async function main() {
  console.log(`${DRY ? '[dry run] ' : ''}Backfilling report ${EDITION} from email sent since ${SINCE.toISOString().slice(0, 10)}\n`)
  const token = await getValidAccessToken()
  if (!token) console.log('No Gmail connection — checking stored bodies only, not attachments.\n')

  const activities = await prisma.crmActivity.findMany({
    where: { type: 'EMAIL', direction: 'OUTBOUND', occurredAt: { gte: SINCE }, personId: { not: null }, person: { deletedAt: null } },
    orderBy: { occurredAt: 'asc' },
    select: { id: true, personId: true, occurredAt: true, subject: true, body: true, sourceRef: true, person: { select: { fullName: true, email: true } } },
  })
  console.log(`${activities.length} outbound emails to check.`)

  // One Gmail fetch per message, however many people were on it.
  const content = new Map<string, string[]>()
  const found = new Map<string, { activityId: string; at: Date; subject: string | null; via: string; name: string }>()
  const otherEditions: string[] = []
  for (const a of activities) {
    const messageId = a.sourceRef?.split(':')[0]
    let names: string[] = []
    if (token && messageId) {
      if (!content.has(messageId)) content.set(messageId, (await getMessageContent(token, messageId, 2000)).attachmentNames)
      names = content.get(messageId)!
    }
    const key = detectReportEdition({ attachmentNames: names, body: a.body })
    if (!key) continue
    if (key !== EDITION) {
      otherEditions.push(`${a.person!.fullName}: ${key} (${a.subject ?? 'no subject'})`)
      continue
    }
    if (!found.has(a.personId!)) {
      const via = names.some((n) => /displacement-report/i.test(n)) ? `attachment ${names.find((n) => /displacement-report/i.test(n))}` : 'report link'
      found.set(a.personId!, { activityId: a.id, at: a.occurredAt, subject: a.subject, via, name: a.person!.fullName })
    }
  }

  console.log(`\nMatched from email (${found.size}):`)
  for (const f of found.values()) console.log(`  ✋ ${f.name} — ${f.at.toISOString().slice(0, 10)}, ${f.via}, "${f.subject ?? ''}"`)
  if (otherEditions.length) console.log(`\nOther editions seen (not marked):\n  ${otherEditions.join('\n  ')}`)

  // The four named people, whether or not their email was found.
  const people = await prisma.crmPerson.findMany({ where: { deletedAt: null }, select: { id: true, fullName: true, email: true, emails: true } })
  const misses: string[] = []
  const forced: { id: string; name: string; note: string }[] = []
  for (const want of ALWAYS) {
    const byEmail = want.email ? people.filter((p) => [p.email, ...p.emails].some((e) => e?.toLowerCase() === want.email!.toLowerCase())) : []
    const byName = byEmail.length ? byEmail : people.filter((p) => squash(p.fullName) === squash(want.name))
    if (byName.length === 0) { misses.push(want.name); continue }
    // Several records for one name: the one the email went to wins, then one with an address.
    const pick = byName.find((p) => found.has(p.id)) ?? byName.find((p) => p.email) ?? byName[0]
    const note = byName.length > 1 ? ` (${byName.length} records share this name — possible duplicate; using ${pick.email ?? pick.id})` : ''
    if (!found.has(pick.id)) forced.push({ id: pick.id, name: pick.fullName, note })
    else if (note) console.log(`  note: ${want.name}${note}`)
  }
  console.log(`\nAlways-include, no email found (${forced.length}):`)
  for (const f of forced) console.log(`  ✋ ${f.name}${f.note}`)
  console.log(`\nMisses — not in the CRM, not created (${misses.length}):${misses.length ? `\n  ${misses.join('\n  ')}` : ' none'}`)

  if (DRY) {
    console.log(`\n[dry run] Would mark ${found.size + forced.length} people as having received ${EDITION}. Nothing written.`)
    return
  }
  let created = 0, updated = 0, kept = 0
  const tally = (r: string) => (r === 'created' ? created++ : r === 'updated' ? updated++ : kept++)
  for (const [personId, f] of found) {
    tally(await markReportManual({ personId, editionKey: EDITION, channel: 'EMAIL', sentAt: f.at, activityId: f.activityId, subject: f.subject, markedByEmail: 'backfill-2026-09' }))
  }
  for (const f of forced) {
    tally(await markReportManual({ personId: f.id, editionKey: EDITION, channel: 'EMAIL', sentAt: SINCE, markedByEmail: 'backfill-2026-09' }))
  }
  console.log(`\nDone: ${created} created, ${updated} updated, ${kept} left as automated.`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
