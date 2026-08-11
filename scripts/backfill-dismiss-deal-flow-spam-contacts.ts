// One-time backfill for the isBulk-gating fix in sync-gmail.ts (recruiter/
// hiring-manager/coach role-mention matching used to run independent of the
// bulk-mail check, so a dealstream.com M&A deal-flow blast or a beehiiv
// newsletter that happened to use "recruiting"/"search" language got flagged
// isRecruiterContact and landed on the Needs a follow-up list as if it were
// a real person). New syncs are already fixed — this dismisses the specific
// already-tracked rows a real user flagged as obviously not real people, so
// they disappear immediately rather than only for future syncs.
//
// Deliberately a hardcoded list of known bad rows, not a broad reclassify —
// TrackedEmailActivity doesn't persist body text, so there's no safe way to
// re-run the real classifier retroactively against everything; scoped to
// senders confirmed by domain (dealstream.com, beehiiv.com) to never be a
// real recruiter/hiring-manager/coach.
//
// Run: npx tsx --env-file=.env.local scripts/backfill-dismiss-deal-flow-spam-contacts.ts --dry-run
//      npx tsx --env-file=.env.local scripts/backfill-dismiss-deal-flow-spam-contacts.ts

import { prisma } from '../src/lib/prisma'

const dryRun = process.argv.includes('--dry-run')

const SPAM_SENDER_ADDRESSES = [
  'helen@mail.smbdealhunter.xyz',
  'searchgenius@genius.dealstream.com',
  'notifications@leads.dealstream.com',
  'onpurposecareers@mail.beehiiv.com',
]

async function main() {
  const rows = await prisma.trackedEmailActivity.findMany({
    where: {
      direction: 'INBOUND',
      isRecruiterContact: true,
      dismissedAt: null,
      OR: SPAM_SENDER_ADDRESSES.map((address) => ({ fromAddress: { contains: address, mode: 'insensitive' } })),
    },
    select: { id: true, fromAddress: true, subject: true },
  })

  console.log(`Found ${rows.length} rows to dismiss:`)
  for (const row of rows) console.log(`  ${dryRun ? '[dry-run] ' : ''}${row.fromAddress} — ${row.subject}`)

  if (dryRun || rows.length === 0) return

  await prisma.trackedEmailActivity.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { dismissedAt: new Date(), isRecruiterContact: false },
  })
  console.log(`Dismissed ${rows.length} rows.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error)
    return prisma.$disconnect().finally(() => process.exit(1))
  })
