// One-time backfill for two REJECTION classification bugs fixed alongside
// this script (see ats-patterns.ts / classify-email.ts):
//
// 1. REJECTION_HIGH_CONFIDENCE's "we decided to move forward with other
//    candidates" pattern required a literal "we " + optional "have " before
//    "decided" — the contraction "we've decided" never matched, so a real
//    rejection ("Update from Paxos" — "...we've decided to move forward
//    with other candidates...") fell through to APPLICATION_CONFIRMATION
//    instead, since its "Thank you for your interest in..." opener matched
//    that category first.
// 2. REJECTION never had a companyName fallback the way APPLICATION_CONFIRMATION
//    does (guessCompanyFromConfirmationText) — a rejection's sender is
//    always an ATS-relay domain (ashbyhq.com, greenhouse.io, ...), never the
//    employer's own domain, so guessCompanyFromDomain correctly returns null
//    for it, same as it does for confirmations. Without the new
//    guessCompanyFromRejectionText fallback, every rejection from an ATS
//    relay landed with companyName: null, and syncJobPostingFromEmail's
//    `if (!companyName) return` silently dropped it — the REJECTION row
//    still got created, but nothing ever touched the candidate's actual
//    JobPosting.declinedAt.
//
// Every INBOUND TrackedEmailActivity row synced before this fix is affected
// if it's either (a) still NEEDS_REVIEW, (b) a REJECTION with a null
// companyName, or (c) an APPLICATION_CONFIRMATION with a null companyName
// (bug #1's failure mode — a real rejection misclassified as a confirmation
// often also fails confirmation's own company extraction, since rejection
// bodies rarely say "applying to X"/"sent to X"). Re-fetches each affected
// message from Gmail, re-runs the CURRENT classification logic against it,
// and if the result changed:
//   - updates the TrackedEmailActivity row's activityType/confidence/companyName
//   - for a REJECTION with a company match against an existing appliedAt
//     JobPosting, sets declinedAt (mirrors syncJobPostingFromEmail's own
//     REJECTION branch)
//   - for an upgrade to APPLICATION_CONFIRMATION/INTERVIEW_INVITE/OFFER,
//     only logs — review and apply by hand (mirrors
//     backfill-classification-fix.ts's own scope decision)
//
// classify-email.ts imports 'server-only' (throws outside a Next server
// bundle), so its logic is reimplemented inline here — same approach as
// scripts/backfill-classification-fix.ts.
//
// Run: npx tsx --env-file=.env.local scripts/backfill-rejection-classification-fix.ts --dry-run
//      npx tsx --env-file=.env.local scripts/backfill-rejection-classification-fix.ts

import { PrismaClient } from '@prisma/client'
import {
  matchRejection,
  matchOffer,
  matchInterviewInvite,
  matchApplicationConfirmation,
  matchRecruiterOutreach,
  isLikelyBulkOrPromotional,
  guessCompanyFromConfirmationText,
  guessCompanyFromRejectionText,
  guessCompanyFromWorkdayTenant,
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
const DRY_RUN = process.argv.includes('--dry-run')

// Mirrors guessCompanyFromDomain in src/lib/email-tracking/classify-email.ts
// exactly, including the GENERIC_MAIL_SUBDOMAIN_LABELS fallback added after
// this script was first written — without it, a dry run of this script
// regresses already-correct rows (e.g. "Beehiiv" from mail.beehiiv.com back
// down to "Mail"). Keep in sync if that function changes again.
const GENERIC_MAIL_SUBDOMAIN_LABELS = new Set([
  'app', 'talent', 'jobalerts', 'careers', 'jobs', 'hr', 'mail', 'notifications', 'no-reply', 'noreply', 'recruiting',
])

function guessCompanyFromDomain(fromAddress: string): string | null {
  const match = extractEmailAddress(fromAddress).match(/@([a-z0-9.-]+)$/i)
  if (!match) return null
  const domain = match[1].toLowerCase()
  const labels = domain.split('.')
  const root = labels.slice(-2).join('.')
  if (NON_COMPANY_DOMAINS.has(root)) return null
  const name = labels[0]
  const resolved = GENERIC_MAIL_SUBDOMAIN_LABELS.has(name) && labels.length > 2 ? root.split('.')[0] : name
  return resolved.charAt(0).toUpperCase() + resolved.slice(1)
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
    return {
      activityType: 'REJECTION',
      confidence: rejection.confidence,
      companyName:
        companyName ?? guessCompanyFromRejectionText(subject, bodyPreview) ?? guessCompanyFromWorkdayTenant(fromAddress),
    }
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
      companyName:
        companyName ?? guessCompanyFromConfirmationText(subject, bodyPreview) ?? guessCompanyFromWorkdayTenant(fromAddress),
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

function findPartByMimeType(part: GmailPart | undefined, mimeType: string, depth = 0): string | null {
  if (!part || depth > 8) return null
  if (part.mimeType === mimeType && part.body?.data) {
    try {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8')
    } catch {
      return null
    }
  }
  for (const sub of part.parts ?? []) {
    const found = findPartByMimeType(sub, mimeType, depth + 1)
    if (found) return found
  }
  return null
}

// Crude but sufficient for regex keyword matching — strip tags, decode the
// handful of entities real ATS templates actually use, collapse whitespace.
// Mirrors sync-gmail.ts's stripHtml exactly.
function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&(lt|gt|#39|quot);/gi, (m) => ({ '&lt;': '<', '&gt;': '>', '&#39;': "'", '&quot;': '"' } as Record<string, string>)[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

// Mirrors sync-gmail.ts's extractBodyPreview exactly — the real HTML part
// carries the actual rejection/status copy for templates (LinkedIn's job
// application-status emails included) that leave text/plain nearly empty.
// Using text/plain alone here would silently diverge from what the live
// sync pipeline actually classified these rows with.
function extractBodyPreview(part: GmailPart | undefined): string {
  const plain = findPartByMimeType(part, 'text/plain') ?? ''
  const html = findPartByMimeType(part, 'text/html')
  const combined = html ? `${plain} ${stripHtml(html)}` : plain
  return combined.slice(0, 4000)
}

// Mirrors syncJobPostingFromEmail's REJECTION branch exactly (see
// src/lib/email-tracking/sync-job-postings.ts) — only ever updates an
// existing JobPosting that already has appliedAt set, never creates one.
async function syncRejection(candidateId: string, companyName: string, emailDate: Date): Promise<string> {
  const normalized = normalizeOrgName(companyName)
  if (!normalized) return 'skipped (unnormalizable company name)'

  const candidates = await prisma.jobPosting.findMany({
    where: { candidateId, companyName: { not: null }, appliedAt: { not: null } },
    orderBy: { appliedAt: 'desc' },
  })
  const match = candidates.find((p) => p.companyName && orgNamesMatch(p.companyName, companyName))
  if (!match) return 'skipped (no matching applied JobPosting)'
  if (match.declinedAt || match.offerReceivedAt) return `already resolved (JobPosting ${match.id})`

  if (!DRY_RUN) {
    await prisma.jobPosting.update({
      where: { id: match.id },
      data: { declinedAt: emailDate, declinedBy: 'COMPANY' },
    })
  }
  return `set declinedAt on JobPosting ${match.id}`
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no writes will be made\n' : 'LIVE RUN — writes will be applied\n')

  const rows = await prisma.trackedEmailActivity.findMany({
    where: {
      direction: 'INBOUND',
      OR: [
        { activityType: 'NEEDS_REVIEW' },
        { activityType: 'REJECTION', companyName: null },
        { activityType: 'APPLICATION_CONFIRMATION', companyName: null },
      ],
    },
    orderBy: { detectedAt: 'asc' },
  })
  console.log(`Found ${rows.length} rows to re-check (NEEDS_REVIEW, or REJECTION/CONFIRMATION with a null company).\n`)

  const tokenCache = new Map<string, string>()
  let changed = 0
  let unchanged = 0
  let rejectionJobPostingChanges = 0
  const flaggedForManualReview: string[] = []

  for (const row of rows) {
    let accessToken = tokenCache.get(row.connectionId)
    if (!accessToken) {
      const connection = await prisma.emailConnection.findUnique({ where: { id: row.connectionId } })
      if (!connection || connection.disconnectedAt) {
        console.log(`Skipping ${row.id} — connection ${row.connectionId} missing/disconnected`)
        continue
      }
      try {
        accessToken = await refreshAccessToken(connection.refreshToken)
      } catch (error) {
        console.log(`Skipping ${row.id} — token refresh failed for connection ${row.connectionId}: ${error}`)
        continue
      }
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

    const activityTypeChanged = result.activityType !== row.activityType
    const companyNameChanged = result.companyName !== row.companyName
    if (!activityTypeChanged && !companyNameChanged) {
      unchanged++
      continue
    }

    changed++
    console.log(`\n[CHANGE] ${row.id}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  ${row.activityType}/${row.companyName ?? 'null'} -> ${result.activityType}/${result.confidence}/${result.companyName ?? 'null'}`)

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

    if (result.activityType === 'REJECTION' && result.companyName) {
      const outcome = await syncRejection(row.candidateId, result.companyName, emailDate)
      console.log(`  JobPosting: ${outcome}`)
      if (outcome.startsWith('set declinedAt')) rejectionJobPostingChanges++
    } else if (result.activityType === 'APPLICATION_CONFIRMATION' || result.activityType === 'INTERVIEW_INVITE' || result.activityType === 'OFFER') {
      flaggedForManualReview.push(`${row.id}: ${subject} -> ${result.activityType}`)
    }
  }

  console.log('\n=== SUMMARY ===')
  console.log(`Rows checked: ${rows.length}`)
  console.log(`Changed: ${changed}`)
  console.log(`Unchanged: ${unchanged}`)
  console.log(`JobPosting.declinedAt set: ${rejectionJobPostingChanges}`)
  if (flaggedForManualReview.length > 0) {
    console.log(`\nFlagged for manual review (non-REJECTION upgrades — JobPosting NOT auto-updated):`)
    flaggedForManualReview.forEach((f) => console.log(`  - ${f}`))
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
