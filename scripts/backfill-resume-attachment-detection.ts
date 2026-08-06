// One-time backfill for the resume-attachment-filename fix in
// src/lib/email-tracking/ats-patterns.ts (matchResumeShared now also
// matches on attachment filename, not just subject/body keywords + any
// attachment). Existing TrackedEmailActivity rows were written under the
// old logic and won't be reprocessed by a normal sync (dedup is by
// externalMessageId), so this re-fetches each OUTBOUND row currently marked
// hasResumeAttachment=false from Gmail and re-evaluates it.
//
// Re-implements the minimal Gmail fetch/refresh/parsing logic inline rather
// than importing sync-gmail.ts/gmail-oauth.ts directly, since those import
// the 'server-only' package, which throws when loaded outside a Next.js
// server-component bundle (plain tsx/node included).
//
// Run: npm run backfill:resume-detection -- --dry-run   (count only)
//      npm run backfill:resume-detection                 (apply updates)

import { PrismaClient } from '@prisma/client'
import { matchResumeShared } from '../src/lib/email-tracking/ats-patterns'

const prisma = new PrismaClient()
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const BODY_PREVIEW_MAX_CHARS = 4000
const dryRun = process.argv.includes('--dry-run')

interface GmailPart {
  mimeType?: string
  filename?: string
  body?: { data?: string }
  parts?: GmailPart[]
}
interface GmailMessage {
  payload?: GmailPart
}

function extractBodyPreview(part: GmailPart | undefined, depth = 0): string {
  if (!part || depth > 8) return ''
  if (part.mimeType === 'text/plain' && part.body?.data) {
    try {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8').slice(0, BODY_PREVIEW_MAX_CHARS)
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

function getAttachmentFilenames(part: GmailPart | undefined, depth = 0): string[] {
  if (!part || depth > 8) return []
  const own = part.filename ? [part.filename] : []
  return own.concat((part.parts ?? []).flatMap((sub) => getAttachmentFilenames(sub, depth + 1)))
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('CANDIDATE_GOOGLE_OAUTH_CLIENT_ID/SECRET are not configured.')
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`)
  return response.json()
}

async function main() {
  const candidates = await prisma.trackedEmailActivity.groupBy({
    by: ['connectionId'],
    where: { direction: 'OUTBOUND', hasResumeAttachment: false },
    _count: true,
  })

  let wouldFlip = 0
  let updated = 0
  let scanned = 0

  for (const group of candidates) {
    const connection = await prisma.emailConnection.findUnique({ where: { id: group.connectionId } })
    if (!connection || connection.disconnectedAt) continue

    let accessToken = connection.accessToken
    if (connection.expiresAt.getTime() - 2 * 60 * 1000 <= Date.now()) {
      try {
        const tokens = await refreshAccessToken(connection.refreshToken)
        accessToken = tokens.access_token
        await prisma.emailConnection.update({
          where: { id: connection.id },
          data: { accessToken, expiresAt: new Date(Date.now() + tokens.expires_in * 1000) },
        })
      } catch (error) {
        console.error(`Skipping connection ${connection.id} — token refresh failed:`, error)
        continue
      }
    }

    const rows = await prisma.trackedEmailActivity.findMany({
      where: { connectionId: connection.id, direction: 'OUTBOUND', hasResumeAttachment: false },
      select: { id: true, externalMessageId: true, subject: true },
    })

    for (const row of rows) {
      scanned++
      const response = await fetch(`${GMAIL_API}/messages/${row.externalMessageId}?format=full`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) {
        console.error(`  message ${row.externalMessageId} fetch failed: ${response.status}`)
        continue
      }
      const message = (await response.json()) as GmailMessage
      const bodyPreview = extractBodyPreview(message.payload)
      const filenames = getAttachmentFilenames(message.payload)
      const matches = matchResumeShared(row.subject ?? '', bodyPreview, filenames)
      if (!matches) continue

      wouldFlip++
      console.log(`  ${dryRun ? '[dry-run] would flip' : 'flipping'}: "${row.subject}" — attachments: ${filenames.join(', ') || '(none)'}`)
      if (!dryRun) {
        await prisma.trackedEmailActivity.update({ where: { id: row.id }, data: { hasResumeAttachment: true } })
        updated++
      }
    }
  }

  console.log(`\nScanned ${scanned} tracked outbound emails across ${candidates.length} connection(s).`)
  console.log(dryRun ? `${wouldFlip} would be marked as resume-shared.` : `${updated} marked as resume-shared.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
