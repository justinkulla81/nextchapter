// One-time backfill for the classification bugs fixed in commits 7f9bc89
// ("Fix two real Gmail classification gaps dropping applications") and
// d47c516 ("Fix bulk-filter short-circuiting legitimate ATS confirmation
// emails"), both merged 2026-08-10 ~02:05-03:27 UTC. Every INBOUND
// TrackedEmailActivity row synced BEFORE that fix landed was classified
// under the old, buggy logic and never gets reprocessed by a normal sync
// (dedup is by externalMessageId) — this is exactly why real applications
// like "Evidence Action", "BGBx", "Big Wave Digital" never made it into the
// Application Tracker even though the identical-template "Bey Group
// International" confirmation (synced after the fix) did.
//
// Re-fetches each affected message from Gmail, re-runs the CURRENT
// classification logic against it, and if the result actually changed:
//   - updates the TrackedEmailActivity row's activityType/confidence/companyName
//   - for a newly-high-confidence APPLICATION_CONFIRMATION, mirrors
//     syncJobPostingFromEmail's create/dedupe logic into JobPosting
//   - for REJECTION/OFFER/INTERVIEW_INVITE upgrades, only logs — those touch
//     scoring-rewrite side effects (rewrite-actions.ts) that this script
//     deliberately doesn't reimplement; review and apply by hand if any show up
//
// classify-email.ts and sync-job-postings.ts both import 'server-only' (which
// throws outside a Next server-component bundle), so their logic is
// reimplemented inline here rather than imported directly — same approach as
// scripts/backfill-resume-attachment-detection.ts.
//
// Run: npx tsx --env-file=.env.local scripts/backfill-classification-fix.ts --dry-run
//      npx tsx --env-file=.env.local scripts/backfill-classification-fix.ts

import { PrismaClient } from '@prisma/client'
import {
  matchRejection,
  matchOffer,
  matchInterviewInvite,
  matchApplicationConfirmation,
  matchRecruiterOutreach,
  isLikelyBulkOrPromotional,
  guessCompanyFromConfirmationText,
  guessTitleFromConfirmationSubject,
} from '../src/lib/email-tracking/ats-patterns'
import { extractDomain, extractEmailAddress } from '../src/lib/email-tracking/email-address'
import { NON_COMPANY_DOMAINS, NEXTCHAPTER_SENDING_DOMAINS } from '../src/lib/text/email-domain'
import { normalizeOrgName, orgNamesMatch } from '../src/lib/text/org-name-match'
import type { EmailActivityType } from '@prisma/client'

interface GmailPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}

const prisma = new PrismaClient()
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
// The earlier of the two fix commits — anything synced before this ran
// under the pre-fix classifier.
const FIX_CUTOFF = new Date('2026-08-10T02:05:52Z')
const DRY_RUN = process.argv.includes('--dry-run')

function guessCompanyFromDomain(fromAddress: string): string | null {
  const match = extractEmailAddress(fromAddress).match(/@([a-z0-9.-]+)$/i)
  if (!match) return null
  const domain = match[1].toLowerCase()
  const root = domain.split('.').slice(-2).join('.')
  if (NON_COMPANY_DOMAINS.has(root)) return null
  const name = domain.split('.')[0]
  return name.charAt(0).toUpperCase() + name.slice(1)
}

type Classification = {
  activityType: string
  confidence: 'high' | 'low'
  companyName: string | null
}

// Mirrors classifyInboundEmail in src/lib/email-tracking/classify-email.ts —
// keep in sync if that function changes before this script is deleted.
function classifyInboundEmail(
  subject: string,
  bodyPreview: string,
  fromAddress: string,
  hasListUnsubscribeHeader: boolean
): Classification {
  const companyName = guessCompanyFromDomain(fromAddress)

  const senderDomain = extractDomain(fromAddress)?.split('.').slice(-2).join('.') ?? null
  if (senderDomain && NEXTCHAPTER_SENDING_DOMAINS.has(senderDomain)) {
    return { activityType: 'NEEDS_REVIEW', confidence: 'low', companyName: null }
  }

  const isBulk = isLikelyBulkOrPromotional(subject, bodyPreview, fromAddress, hasListUnsubscribeHeader)
  const winsOverBulk = (confidence: 'high' | 'low') => confidence === 'high' || !isBulk

  const rejection = matchRejection(subject, bodyPreview)
  if (rejection.matched && winsOverBulk(rejection.confidence)) {
    return { activityType: 'REJECTION', confidence: rejection.confidence, companyName }
  }

  const offer = matchOffer(subject, bodyPreview)
  if (offer.matched && winsOverBulk(offer.confidence)) {
    return { activityType: 'OFFER', confidence: offer.confidence, companyName }
  }

  const interview = matchInterviewInvite(subject, bodyPreview)
  if (interview.matched && winsOverBulk(interview.confidence)) {
    return { activityType: 'INTERVIEW_INVITE', confidence: interview.confidence, companyName }
  }

  const confirmation = matchApplicationConfirmation(subject, bodyPreview)
  if (confirmation.matched && winsOverBulk(confirmation.confidence)) {
    return {
      activityType: 'APPLICATION_CONFIRMATION',
      confidence: confirmation.confidence,
      companyName: companyName ?? guessCompanyFromConfirmationText(subject, bodyPreview),
    }
  }

  const outreach = matchRecruiterOutreach(subject, bodyPreview, fromAddress)
  if (outreach.matched && !isBulk) {
    return { activityType: 'RECRUITER_OUTREACH', confidence: outreach.confidence, companyName }
  }

  return { activityType: 'NEEDS_REVIEW', confidence: 'low', companyName }
}

async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID!
  const clientSecret = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_SECRET!
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await response.json()
  if (!response.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
  return data.access_token as string
}

function getHeader(headers: { name: string; value: string }[] | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function extractBodyPreview(part: GmailPart | undefined, depth = 0): string {
  if (!part || depth > 8) return ''
  if (part.mimeType === 'text/plain' && part.body?.data) {
    try {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8').slice(0, 4000)
    } catch {
      return ''
    }
  }
  for (const sub of part.parts ?? []) {
    const found = extractBodyPreview(sub, depth + 1)
    if (found) return found
  }
  return ''
}

// Mirrors syncJobPostingFromEmail's APPLICATION_CONFIRMATION branch exactly
// (see src/lib/email-tracking/sync-job-postings.ts) — REJECTION/INTERVIEW_INVITE
// upgrades are deliberately NOT mirrored here (see file header).
async function syncApplicationConfirmation(
  candidateId: string,
  companyName: string,
  subject: string,
  emailDate: Date
): Promise<string> {
  const normalized = normalizeOrgName(companyName)
  if (!normalized) return 'skipped (unnormalizable company name)'

  const existingForCompany = await prisma.jobPosting.findMany({
    where: { candidateId, companyName: { not: null } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, companyName: true, appliedAt: true },
  })
  const existingMatch = existingForCompany.find((p) => orgNamesMatch(p.companyName ?? '', companyName))
  if (existingMatch) {
    if (!existingMatch.appliedAt) {
      if (!DRY_RUN) {
        await prisma.jobPosting.update({ where: { id: existingMatch.id }, data: { appliedAt: emailDate } })
      }
      return `backfilled appliedAt on existing JobPosting ${existingMatch.id}`
    }
    return `already tracked (JobPosting ${existingMatch.id})`
  }

  const sameDayRows = await prisma.jobPosting.findMany({
    where: {
      candidateId,
      source: 'EMAIL_DETECTED',
      companyName: { not: null },
      appliedAt: {
        gte: new Date(emailDate.getFullYear(), emailDate.getMonth(), emailDate.getDate()),
        lt: new Date(emailDate.getFullYear(), emailDate.getMonth(), emailDate.getDate() + 1),
      },
    },
    select: { companyName: true },
  })
  if (sameDayRows.some((r) => orgNamesMatch(r.companyName ?? '', companyName))) {
    return 'skipped (same-day duplicate confirmation)'
  }

  if (!DRY_RUN) {
    await prisma.jobPosting.create({
      data: {
        candidateId,
        source: 'EMAIL_DETECTED',
        fetchStatus: 'no_url',
        companyName,
        title: guessTitleFromConfirmationSubject(subject),
        appliedAt: emailDate,
      },
    })
  }
  return 'created new JobPosting'
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no writes will be made\n' : 'LIVE RUN — writes will be applied\n')

  const rows = await prisma.trackedEmailActivity.findMany({
    where: { direction: 'INBOUND', activityType: 'NEEDS_REVIEW', detectedAt: { lt: FIX_CUTOFF } },
    orderBy: { detectedAt: 'asc' },
  })
  console.log(`Found ${rows.length} pre-fix NEEDS_REVIEW inbound rows to re-check.\n`)

  const tokenCache = new Map<string, string>()
  let upgraded = 0
  let stillNeedsReview = 0
  let jobPostingChanges = 0
  const flaggedForManualReview: string[] = []

  for (const row of rows) {
    let accessToken = tokenCache.get(row.connectionId)
    if (!accessToken) {
      const connection = await prisma.emailConnection.findUnique({ where: { id: row.connectionId } })
      if (!connection || connection.disconnectedAt) {
        console.log(`Skipping ${row.id} — connection ${row.connectionId} missing/disconnected`)
        continue
      }
      accessToken = await refreshAccessToken(connection.refreshToken)
      tokenCache.set(row.connectionId, accessToken)
    }

    const res = await fetch(`${GMAIL_API}/messages/${row.externalMessageId}?format=full`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) {
      console.log(`Skipping ${row.id} (${row.subject}) — Gmail fetch failed: ${res.status}`)
      continue
    }
    const message = await res.json()
    const subject = getHeader(message.payload?.headers, 'Subject')
    const from = getHeader(message.payload?.headers, 'From')
    const bodyPreview = extractBodyPreview(message.payload)
    const listUnsubscribe = getHeader(message.payload?.headers, 'List-Unsubscribe')
    const dateHeader = getHeader(message.payload?.headers, 'Date')
    const parsedDate = dateHeader ? new Date(dateHeader) : null
    const emailDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : row.detectedAt

    const result = classifyInboundEmail(subject, bodyPreview, from, !!listUnsubscribe)

    if (result.activityType === 'NEEDS_REVIEW') {
      stillNeedsReview++
      continue
    }

    upgraded++
    console.log(`\n[UPGRADE] ${row.id}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  NEEDS_REVIEW/low -> ${result.activityType}/${result.confidence} (company: ${result.companyName ?? 'null'})`)

    if (!DRY_RUN) {
      await prisma.trackedEmailActivity.update({
        where: { id: row.id },
        data: {
          activityType: result.activityType as EmailActivityType,
          confidence: result.confidence,
          companyName: result.companyName,
        },
      })
    }

    if (result.activityType === 'APPLICATION_CONFIRMATION' && result.confidence === 'high' && result.companyName) {
      const outcome = await syncApplicationConfirmation(row.candidateId, result.companyName, subject, emailDate)
      console.log(`  JobPosting: ${outcome}`)
      if (outcome !== 'already tracked') jobPostingChanges++
    } else if (result.activityType === 'REJECTION' || result.activityType === 'INTERVIEW_INVITE' || result.activityType === 'OFFER') {
      flaggedForManualReview.push(`${row.id}: ${subject} -> ${result.activityType}`)
    }
  }

  console.log('\n=== SUMMARY ===')
  console.log(`Rows checked: ${rows.length}`)
  console.log(`Upgraded from NEEDS_REVIEW: ${upgraded}`)
  console.log(`Still NEEDS_REVIEW under current classifier: ${stillNeedsReview}`)
  console.log(`JobPosting rows created/updated: ${jobPostingChanges}`)
  if (flaggedForManualReview.length > 0) {
    console.log(`\nFlagged for manual review (REJECTION/INTERVIEW_INVITE/OFFER upgrades — JobPosting NOT auto-updated):`)
    flaggedForManualReview.forEach((f) => console.log(`  - ${f}`))
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
