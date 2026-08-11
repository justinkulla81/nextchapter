// Companion to backfill-null-company-confirmations.ts — handles rows still
// null after that fix, caused by a second gap in the same extraction logic:
// ATS confirmation subjects that lead with the company name before a dash
// ("Legora - Thank you for applying - Director of Corporate Development",
// Ashby's own template) and title-cased "applying to" phrasing ("Thank You
// for Applying to BGBx") weren't recognized by guessCompanyFromConfirmationSubject
// until the 2026-08-11 fix to ats-patterns.ts. Same syncApplicationConfirmation
// mirroring as the companion script, just re-run against whatever's still null.
//
// Run: npx tsx --env-file=.env.local scripts/backfill-ashby-prefix-company-confirmations.ts --dry-run
//      npx tsx --env-file=.env.local scripts/backfill-ashby-prefix-company-confirmations.ts

import { PrismaClient } from '@prisma/client'
import { guessCompanyFromConfirmationText, guessTitleFromConfirmationSubject } from '../src/lib/email-tracking/ats-patterns'
import { normalizeOrgName, orgNamesMatch } from '../src/lib/text/org-name-match'

interface GmailPart {
  mimeType?: string
  body?: { data?: string }
  parts?: GmailPart[]
}

const prisma = new PrismaClient()
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const DRY_RUN = process.argv.includes('--dry-run')

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

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&(lt|gt|#39|quot);/gi, (m) => ({ '&lt;': '<', '&gt;': '>', '&#39;': "'", '&quot;': '"' })[m.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

function extractBodyPreview(part: GmailPart | undefined): string {
  const plain = findPartByMimeType(part, 'text/plain') ?? ''
  const html = findPartByMimeType(part, 'text/html')
  const combined = html ? `${plain} ${stripHtml(html)}` : plain
  return combined.slice(0, 4000)
}

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
      if (!DRY_RUN) await prisma.jobPosting.update({ where: { id: existingMatch.id }, data: { appliedAt: emailDate } })
      return `backfilled appliedAt on existing JobPosting ${existingMatch.id}`
    }
    return `already tracked (JobPosting ${existingMatch.id})`
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
    where: { direction: 'INBOUND', activityType: 'APPLICATION_CONFIRMATION', companyName: null },
    orderBy: { detectedAt: 'asc' },
  })
  console.log(`Found ${rows.length} APPLICATION_CONFIRMATION rows still missing a company name.\n`)

  const tokenCache = new Map<string, string>()

  for (const row of rows) {
    let accessToken = tokenCache.get(row.connectionId)
    if (!accessToken) {
      const connection = await prisma.emailConnection.findUnique({ where: { id: row.connectionId } })
      if (!connection || connection.disconnectedAt) {
        console.log(`Skipping ${row.id} — connection missing/disconnected`)
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
    const bodyPreview = extractBodyPreview(message.payload)
    const dateHeader = getHeader(message.payload?.headers, 'Date')
    const parsedDate = dateHeader ? new Date(dateHeader) : null
    const emailDate = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : row.detectedAt

    const companyName = guessCompanyFromConfirmationText(subject, bodyPreview)
    console.log(`\n${row.id}`)
    console.log(`  Subject: ${subject}`)
    console.log(`  Company (re-extracted): ${companyName ?? 'still null'}`)

    if (!companyName) continue

    if (!DRY_RUN) {
      await prisma.trackedEmailActivity.update({ where: { id: row.id }, data: { companyName } })
    }
    const outcome = await syncApplicationConfirmation(row.candidateId, companyName, subject, emailDate)
    console.log(`  JobPosting: ${outcome}`)
  }

  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
