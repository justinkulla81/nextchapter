// The classifier fix in commit 84fe84a added a NEXTCHAPTER_SENDING_DOMAINS
// short-circuit (src/lib/email-tracking/classify-email.ts) so NextChapter's
// own transactional mail (daily nudges, weekly grade emails, etc. — all sent
// from launchyournextchapter.com) can never be misclassified as a job
// REJECTION/INTERVIEW_INVITE/OFFER again. But that fix only changes what
// happens on the *next* sync — syncGmailConnection dedupes by
// externalMessageId, so any bad TrackedEmailActivity row written before the
// fix landed is never reprocessed and keeps counting in stats forever.
//
// This is a one-time sweep: find every TrackedEmailActivity row whose stored
// fromAddress resolves to a NextChapter sending domain and dismiss it, the
// same way a candidate manually correcting a bad classification would.
//
// Run: npm run backfill:dismiss-selfmail -- --dry-run   (count only)
//      npm run backfill:dismiss-selfmail                 (apply)

import { PrismaClient } from '@prisma/client'
import { extractDomain } from '../src/lib/email-tracking/email-address'
import { NEXTCHAPTER_SENDING_DOMAINS } from '../src/lib/text/email-domain'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

function isNextChapterSelfMail(fromAddress: string | null): boolean {
  if (!fromAddress) return false
  const domain = extractDomain(fromAddress)?.split('.').slice(-2).join('.') ?? null
  return !!domain && NEXTCHAPTER_SENDING_DOMAINS.has(domain)
}

async function main() {
  const candidates = await prisma.trackedEmailActivity.findMany({
    where: { dismissedAt: null },
    select: { id: true, fromAddress: true, activityType: true, companyName: true, subject: true },
  })
  const toDismiss = candidates.filter((row) => isNextChapterSelfMail(row.fromAddress))

  console.log(`Scanned ${candidates.length} live rows, found ${toDismiss.length} from a NextChapter sending domain.`)
  for (const row of toDismiss) {
    console.log(`  ${row.activityType} — ${row.subject ?? '(no subject)'} — ${row.fromAddress}`)
  }

  if (dryRun) {
    console.log('Dry run — no changes made. Re-run without --dry-run to dismiss these rows.')
    return
  }

  if (toDismiss.length === 0) return
  const { count } = await prisma.trackedEmailActivity.updateMany({
    where: { id: { in: toDismiss.map((r) => r.id) } },
    data: { dismissedAt: new Date() },
  })
  console.log(`Dismissed ${count} rows.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
