/**
 * Re-checks a candidate's Gmail with the current classifier and fills in
 * mail the old sync never reached.
 *
 *   npm run email:rescan -- <candidateId|all>            # dry run: prints what would change
 *   npm run email:rescan -- <candidateId|all> --commit
 *
 * 1. Reclassify: every inbound row still sitting as APPLICATION_CONFIRMATION
 *    or NEEDS_REVIEW (never one a candidate reviewed or dismissed) is
 *    re-fetched and re-run through classifyInboundEmail. Anything that's now
 *    a REJECTION is updated and mirrored onto My Applications, without points.
 * 2. Fill gaps (--commit --rewind): rewinds the sync bookmark to the start of
 *    the first-sync window; the hourly /api/cron/gmail-sync job then walks it
 *    forward to today. Already-tracked messages are skipped; points are never
 *    awarded for mail older than a week (see POINTS_WINDOW_MS in sync-gmail.ts).
 */
import { prisma } from '../../src/lib/prisma'
import { classifyInboundEmail } from '../../src/lib/email-tracking/classify-email'
import { orgNamesMatch } from '../../src/lib/text/org-name-match'
import { extractEmailBody, getHeader, type GmailMessage } from '../../src/lib/google/gmail-body'

const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me'
const COMMIT = process.argv.includes('--commit')
const target = process.argv.slice(2).find((a) => !a.startsWith('--'))
const BACKFILL_MS = 90 * 24 * 60 * 60 * 1000

async function token(refreshToken: string): Promise<string> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.CANDIDATE_GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const d = await r.json()
  if (!r.ok) throw new Error(`token refresh failed: ${JSON.stringify(d)}`)
  return d.access_token
}

async function getMessage(tok: string, id: string): Promise<GmailMessage | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const r = await fetch(`${GMAIL}/messages/${id}?format=full`, { headers: { Authorization: `Bearer ${tok}` } })
    if (r.ok) return r.json()
    // Gmail's per-minute quota answers 403 "rateLimitExceeded", not 429.
    const quota = r.status === 403 && /rateLimitExceeded|quotaExceeded/.test(await r.text())
    if (!quota && r.status !== 429 && r.status < 500) return null
    await new Promise((res) => setTimeout(res, 15000))
  }
  return null
}

async function main() {
  if (!target) throw new Error('Pass a candidateId or "all".')
  console.log(`MAIL RESCAN — ${COMMIT ? 'COMMIT' : 'DRY RUN'}`)
  const connections = await prisma.emailConnection.findMany({
    where: { disconnectedAt: null, needsReconnectAt: null, ...(target === 'all' ? {} : { candidateId: target }) },
  })

  for (const c of connections) {
    console.log(`\n== candidate ${c.candidateId}`)
    const tok = await token(c.refreshToken)

    const rows = await prisma.trackedEmailActivity.findMany({
      where: {
        connectionId: c.id, direction: 'INBOUND', reviewedAt: null, dismissedAt: null,
        activityType: { in: ['APPLICATION_CONFIRMATION', 'NEEDS_REVIEW'] },
      },
      select: { id: true, externalMessageId: true, activityType: true, subject: true, fromAddress: true },
    })
    console.log(`reclassify: checking ${rows.length} rows`)
    let flipped = 0
    let next = 0
    async function worker() {
      while (next < rows.length) {
        const row = rows[next++]
        const msg = await getMessage(tok, row.externalMessageId)
        if (!msg) continue
        const subject = getHeader(msg.payload?.headers, 'Subject')
        const from = getHeader(msg.payload?.headers, 'From')
        const body = extractEmailBody(msg.payload, 4000)
        const unsub = !!getHeader(msg.payload?.headers, 'List-Unsubscribe')
        const result = classifyInboundEmail(subject, body, from, unsub)
        if (result.activityType !== 'REJECTION' || result.confidence !== 'high') continue
        flipped++
        console.log(`  ${row.activityType} -> REJECTION | ${result.companyName ?? '?'} | ${subject}`)
        if (!COMMIT) continue
        await prisma.trackedEmailActivity.update({
          where: { id: row.id },
          data: { activityType: 'REJECTION', confidence: 'high', companyName: result.companyName },
        })
        const dateHeader = getHeader(msg.payload?.headers, 'Date')
        const date = dateHeader && !isNaN(new Date(dateHeader).getTime()) ? new Date(dateHeader) : new Date()
        // Mirrors syncJobPostingFromEmail's REJECTION branch (that module
        // can't load outside the app): mark the matching application declined.
        if (result.companyName) {
          const apps = await prisma.jobPosting.findMany({
            where: { candidateId: c.candidateId, companyName: { not: null }, appliedAt: { not: null } },
            orderBy: { appliedAt: 'desc' },
          })
          const app = apps.find((a) => a.companyName && orgNamesMatch(a.companyName, result.companyName!))
          if (app && !app.declinedAt && !app.offerReceivedAt) {
            await prisma.jobPosting.update({ where: { id: app.id }, data: { declinedAt: date, declinedBy: 'COMPANY' } })
            console.log(`    marked application to ${app.companyName} declined`)
          }
        }
      }
    }
    await Promise.all(Array.from({ length: 3 }, worker))
    console.log(`reclassify: ${flipped} ${COMMIT ? 'updated' : 'would change'} to REJECTION`)

    if (!COMMIT || !process.argv.includes('--rewind')) continue
    // Mail the old sync skipped entirely: rewind the bookmark and let the
    // hourly /api/cron/gmail-sync job walk it forward (the sync code itself
    // only runs inside the app).
    const start = new Date(Math.min(c.connectedAt.getTime() - BACKFILL_MS, c.lastSyncAt?.getTime() ?? Date.now()))
    await prisma.emailConnection.update({ where: { id: c.id }, data: { lastSyncAt: start } })
    console.log(`bookmark rewound to ${start.toISOString().slice(0, 10)} — the hourly sync will fill the gap`)
  }
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
