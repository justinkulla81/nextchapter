// One-off, targeted backfill for the two specific bad JobPosting rows the
// user reported by screenshot (2026-08-14) — not a blanket data migration.
// Both are caused by extraction bugs fixed in the same commit series as this
// script: sanitizeExtractedTitle() (title swallowing a trailing comp figure)
// and the "application to <Company>" CONFIRMATION_COMPANY_SUFFIX gap
// (company field picking up marketing copy from the body instead).
//
// Run: npx tsx --env-file=.env.local scripts/backfill-two-title-company-rows.ts --dry-run
//      npx tsx --env-file=.env.local scripts/backfill-two-title-company-rows.ts

import { PrismaClient } from '@prisma/client'
import { sanitizeExtractedTitle, guessCompanyFromConfirmationSubject } from '../src/lib/email-tracking/ats-patterns'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no writes will be made\n' : 'LIVE RUN — writes will be applied\n')

  // Row 1: "Head of Community - Venture Studio - $250,000-$300,000 + Equity"
  // Saragossa is already the correct company (subject: "Justin, your
  // application was sent to Saragossa") — only the title needs fixing.
  const row1 = await prisma.jobPosting.findUnique({ where: { id: 'cmst7j0640005jj04d1gtq4zz' } })
  if (row1) {
    const fixedTitle = sanitizeExtractedTitle(row1.title ?? '')
    console.log(`Row 1 (${row1.id}): "${row1.title}" -> "${fixedTitle}"`)
    if (!DRY_RUN && fixedTitle) {
      await prisma.jobPosting.update({ where: { id: row1.id }, data: { title: fixedTitle } })
    }
  } else {
    console.log('Row 1 not found (already fixed or removed)')
  }

  // Row 2: companyName "Zoom visiting our LinkedIn Best" (title already
  // null). Real subject: "Justin, Thank you for your application to Zoom
  // Communications" — re-derive from the subject directly now that
  // guessCompanyFromConfirmationSubject covers this shape.
  const row2 = await prisma.jobPosting.findUnique({ where: { id: 'cmst9ccjn0009jv04fg56197e' } })
  if (row2) {
    const fixedCompany = guessCompanyFromConfirmationSubject(
      'Justin, Thank you for your application to Zoom Communications'
    )
    console.log(`Row 2 (${row2.id}): "${row2.companyName}" -> "${fixedCompany}"`)
    if (!DRY_RUN && fixedCompany) {
      await prisma.jobPosting.update({ where: { id: row2.id }, data: { companyName: fixedCompany } })
    }
  } else {
    console.log('Row 2 not found (already fixed or removed)')
  }

  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
