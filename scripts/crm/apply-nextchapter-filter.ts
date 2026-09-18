/**
 * Applies the NextChapter-mention rule to activity the sync already logged
 * before this rule existed.
 *
 * By direct instruction: an inbound email is never CRM activity unless it
 * mentions NextChapter; an outbound one that doesn't mention it still
 * counts as real outreach, but needs a human to confirm it before it does.
 *
 * - INBOUND, auto-logged, doesn't mention NextChapter: backed up to JSON,
 *   then deleted. These were never supposed to exist under the new rule.
 * - OUTBOUND, auto-logged, doesn't mention NextChapter, not already
 *   flagged: marked needsReview instead — nothing is removed, it just
 *   stops counting as outreach until approved on /support/admin/crm/needs-review.
 *
 * Hand-typed activity (isAutoLogged: false — a call, a LinkedIn message you
 * logged yourself) is untouched; you already reviewed those by typing them.
 *
 *   npm run crm:nextchapter-filter                    — report + write backup
 *   npm run crm:nextchapter-filter -- --write         — apply
 */
import { writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { CRM_ACTIVITY_CUTOFF } from '../../src/lib/crm/cutoff'
import { mentionsNextChapter } from '../../src/lib/crm/sync-matching'
import { refreshTouchFields } from '../../src/lib/crm/sync'

const prisma = new PrismaClient()
const WRITE = process.argv.includes('--write')
const BACKUP = process.argv.find((a) => a.startsWith('--backup='))?.split('=')[1]
  ?? `inbound-noise-${new Date().toISOString().slice(0, 10)}.json`

function snippetOf(body: string | null): string | null {
  return body ? body.replace(/\s+/g, ' ').trim().slice(0, 200) : null
}

async function main() {
  console.log(`cutoff ${CRM_ACTIVITY_CUTOFF.toISOString()} · ${WRITE ? 'WRITING' : 'dry run'}`)

  const rows = await prisma.crmActivity.findMany({
    where: { type: 'EMAIL', isAutoLogged: true, occurredAt: { gte: CRM_ACTIVITY_CUTOFF } },
    select: {
      id: true, personId: true, direction: true, subject: true, body: true, needsReview: true, occurredAt: true,
      person: { select: { fullName: true } },
    },
  })

  const doomed = rows.filter((r) => r.direction === 'INBOUND' && !mentionsNextChapter(r.subject, snippetOf(r.body)))
  const toReview = rows.filter(
    (r) => r.direction === 'OUTBOUND' && !r.needsReview && !mentionsNextChapter(r.subject, snippetOf(r.body)),
  )

  console.log(`${rows.length} auto-logged emails since cutoff`)
  console.log(`  ${doomed.length} inbound, no NextChapter mention — will be DELETED`)
  console.log(`  ${toReview.length} outbound, no NextChapter mention — will need REVIEW`)

  const byPerson = new Map<string, number>()
  for (const r of doomed) byPerson.set(r.person?.fullName ?? '?', (byPerson.get(r.person?.fullName ?? '?') ?? 0) + 1)
  console.log('\n  inbound removals by person (top 15):')
  for (const [name, n] of [...byPerson.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`    ${name}: ${n}`)
  }
  console.log('\n  sample subjects going to review:')
  for (const r of toReview.slice(0, 10)) console.log(`    ${r.person?.fullName ?? '?'} — "${r.subject ?? ''}"`)

  writeFileSync(BACKUP, JSON.stringify(doomed, null, 2))
  console.log(`\nbackup written: ${BACKUP}`)

  if (!WRITE) {
    console.log('\ndry run — nothing changed. Re-run with --write.')
    return
  }

  const affected = new Set<string>()
  if (doomed.length > 0) {
    await prisma.crmActivity.deleteMany({ where: { id: { in: doomed.map((r) => r.id) } } })
    for (const r of doomed) if (r.personId) affected.add(r.personId)
  }
  if (toReview.length > 0) {
    await prisma.crmActivity.updateMany({
      where: { id: { in: toReview.map((r) => r.id) } },
      data: { needsReview: true },
    })
    for (const r of toReview) if (r.personId) affected.add(r.personId)
  }

  console.log(`deleted ${doomed.length}, flagged ${toReview.length} — recomputing ${affected.size} people`)
  await refreshTouchFields([...affected])
  console.log('done')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
