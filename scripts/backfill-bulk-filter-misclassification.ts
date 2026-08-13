// One-time backfill for the classifyInboundEmail priority-order fix in
// src/lib/email-tracking/classify-email.ts — isLikelyBulkOrPromotional's
// List-Unsubscribe check used to short-circuit BEFORE any category matcher
// ran, so a legitimate ATS confirmation email (Greenhouse/Lever/Workday all
// attach that header to transactional mail too) landed in NEEDS_REVIEW
// regardless of how clearly it read as a real application confirmation.
// Fixing the function only helps mail scanned from here on — a normal sync
// dedupes by externalMessageId and never re-fetches/re-classifies a message
// it's already seen, so this re-runs the real classifier against every
// existing NEEDS_REVIEW row's stored subject (body isn't persisted — see
// TrackedEmailActivity.subject's comment — so this is necessarily
// subject-only, same limitation as the ats-patterns confirmation-format
// fixes earlier this batch) and updates + syncs whatever now resolves to a
// real category.
//
// Imports the real classifyInboundEmail/syncJobPostingFromEmail — not a
// reimplementation — so this stays consistent with live app behavior.
// Both ultimately import 'server-only' (via sync-job-postings' prisma
// import), which throws under plain tsx — run with the react-server export
// condition to get the no-op stub instead (see server-only's package.json
// exports map).
//
// Run: npm run backfill:bulk-filter -- --dry-run   (count only)
//      npm run backfill:bulk-filter                 (apply updates)

import { prisma } from '../src/lib/prisma'
import { classifyInboundEmail } from '../src/lib/email-tracking/classify-email'
import { syncJobPostingFromEmail } from '../src/lib/email-tracking/sync-job-postings'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const candidates = await prisma.trackedEmailActivity.findMany({
    where: { direction: 'INBOUND', activityType: 'NEEDS_REVIEW', dismissedAt: null },
    select: { id: true, candidateId: true, subject: true, fromAddress: true, detectedAt: true },
  })

  console.log(`Scanning ${candidates.length} NEEDS_REVIEW inbound rows...`)

  let reclassified = 0
  const byNewType = new Map<string, number>()

  for (const row of candidates) {
    if (!row.subject || !row.fromAddress) continue

    // No stored body or List-Unsubscribe header — subject-only re-check,
    // same constraint documented above.
    const result = classifyInboundEmail(row.subject, '', row.fromAddress, false)
    if (result.activityType === 'NEEDS_REVIEW') continue

    // RECRUITER_OUTREACH's high confidence is sender-domain-based, not
    // phrasing-based, so without the real body/header this backfill can't
    // tell a genuine outreach email from a bulk job-alert digest sent from
    // the same recruiting-firm domain — confirmed against a real "171
    // Remote Jobs are Live" digest reclassifying this way. Application
    // confirmation/rejection/offer/interview matches are all phrasing-based
    // and don't have this ambiguity, so only those are safe to backfill.
    if (result.activityType === 'RECRUITER_OUTREACH') {
      console.log(`[skipped, ambiguous without original headers] ${row.subject}`)
      continue
    }

    reclassified++
    byNewType.set(result.activityType, (byNewType.get(result.activityType) ?? 0) + 1)
    console.log(
      `${dryRun ? '[dry-run] ' : ''}${row.subject} -> ${result.activityType} (${result.companyName ?? 'no company'})`
    )

    if (dryRun) continue

    await prisma.trackedEmailActivity.update({
      where: { id: row.id },
      data: { activityType: result.activityType, confidence: result.confidence, companyName: result.companyName },
    })

    await syncJobPostingFromEmail(row.candidateId, result.activityType, result.companyName, row.subject, '', row.detectedAt)
  }

  console.log(`\n${dryRun ? 'Would reclassify' : 'Reclassified'} ${reclassified} of ${candidates.length}:`)
  for (const [type, count] of byNewType) console.log(`  ${type}: ${count}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error)
    return prisma.$disconnect().finally(() => process.exit(1))
  })
