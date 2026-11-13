import 'server-only'
import type { Resend } from 'resend'
import { createResend } from '@/lib/email/resend-client'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { computeRoster, rosterCounts, type RosterRow } from './roster'
import { renderEmail } from './render'
import { tagMailingLinks } from '@/lib/marketing/email-attribution'
import { makeUnsubscribeToken } from './unsubscribe-token'
import { addToLists, doNotEmailPeople, getMailingSettings, syncWebsiteSignups } from './lists'
import { withAudienceHtml, withAudienceText, type EmailAudience } from '@/lib/email/audience-tag'
import { communityStatsFor } from '@/lib/org-claims/community-stats'
import { communityStatSentence } from '@/lib/org-claims/format'
import { claimUrlFor } from '@/lib/org-claims/urls'

export const MAILING_BUCKET = 'mailing-files'
export const ATTACH_WARN_BYTES = 5 * 1024 * 1024
const MAX_ATTEMPTS = 2 // the first try, then one retry

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com').replace(/\/$/, '')
}

/** CrmActivity.sourceRef for a mailing send: points back at the recipient row. */
export const MAILING_REF_PREFIX = 'mailing:'
export const mailingSourceRef = (recipientId: string) => `${MAILING_REF_PREFIX}${recipientId}`

/**
 * Everyone another version of this email (its original or any copy) has
 * already been sent to: address → when. Empty for an email with no versions.
 */
export async function earlierVersionSends(editionId: string, versionOfId: string | null): Promise<Map<string, Date>> {
  const rootId = versionOfId ?? editionId
  const rows = await prisma.mailingEditionRecipient.findMany({
    where: { status: 'SENT', editionId: { not: editionId }, edition: { OR: [{ id: rootId }, { versionOfId: rootId }] } },
    select: { email: true, sentAt: true },
  })
  return new Map(rows.map((r) => [r.email, r.sentAt!]))
}

/** The link to an edition's uploaded file, on the site. */
export function fileUrlFor(editionKey: string): string {
  return `${appUrl()}/reports/files/${encodeURIComponent(editionKey)}`
}

export async function ensureBucket() {
  const admin = createAdminClient()
  const { data } = await admin.storage.getBucket(MAILING_BUCKET)
  if (!data) await admin.storage.createBucket(MAILING_BUCKET, { public: false, fileSizeLimit: 25 * 1024 * 1024 })
  return admin
}

function toRow(r: {
  email: string; personId: string | null; source: 'BASE' | 'ADDED_THIS_EDITION'; excluded: boolean
  excludedReason: string | null; fromListKeys: string[]; alsoAddToListIds: string[]; status: string
}): RosterRow {
  return { ...r }
}

/**
 * Brings the stored roster in line with the target lists: new ACTIVE
 * members appear (unchecked if they already got this report by hand),
 * people who left drop off, choices made in the composer stand. Never runs
 * once sending has started — from then on the roster is the record.
 */
export async function syncEditionRoster(editionId: string) {
  const edition = await prisma.mailingEdition.findUniqueOrThrow({
    where: { id: editionId },
    include: { lists: { include: { list: { select: { id: true, key: true } } } }, recipients: true },
  })
  if (edition.status === 'SENDING' || edition.status === 'SENT') return
  await syncWebsiteSignups()

  const listIds = edition.lists.map((l) => l.listId)
  const keyById = new Map(edition.lists.map((l) => [l.list.id, l.list.key]))
  const members = listIds.length
    ? await prisma.mailingListMember.findMany({ where: { listId: { in: listIds } }, select: { email: true, personId: true, listId: true, status: true } })
    : []
  const suppressed = new Set((await prisma.mailingSuppression.findMany({ select: { email: true } })).map((s) => s.email))
  // Do not email covers every address on the record, including newer ones.
  for (const e of (await doNotEmailPeople()).emails) suppressed.add(e)
  const manual = edition.isReport && edition.reportKey
    ? await prisma.crmReportSend.findMany({ where: { editionKey: edition.reportKey, method: 'MANUAL' }, select: { personId: true, sentAt: true } })
    : []

  const earlierSends = await earlierVersionSends(edition.id, edition.versionOfId)

  const next = computeRoster({
    members: members.map((m) => ({ email: m.email, personId: m.personId, listKey: keyById.get(m.listId)!, status: m.status })),
    existing: edition.recipients.map(toRow),
    suppressed,
    manualSends: new Map(manual.map((m) => [m.personId, m.sentAt])),
    versionSends: earlierSends,
  })

  const nextEmails = new Set(next.map((r) => r.email))
  const stale = edition.recipients.filter((r) => !nextEmails.has(r.email)).map((r) => r.id)
  const byEmail = new Map(edition.recipients.map((r) => [r.email, r]))
  const writes: Prisma.PrismaPromise<unknown>[] = []
  if (stale.length) writes.push(prisma.mailingEditionRecipient.deleteMany({ where: { id: { in: stale } } }))
  for (const r of next) {
    const prev = byEmail.get(r.email)
    if (!prev) {
      writes.push(prisma.mailingEditionRecipient.create({
        data: {
          editionId, email: r.email, personId: r.personId, source: r.source, excluded: r.excluded,
          excludedReason: r.excludedReason, fromListKeys: r.fromListKeys, alsoAddToListIds: r.alsoAddToListIds,
        },
      }))
    } else if (
      prev.source !== r.source || prev.excluded !== r.excluded || prev.personId !== r.personId ||
      prev.fromListKeys.join() !== r.fromListKeys.join()
    ) {
      writes.push(prisma.mailingEditionRecipient.update({
        where: { id: prev.id },
        data: { source: r.source, excluded: r.excluded, excludedReason: r.excludedReason, personId: r.personId, fromListKeys: r.fromListKeys },
      }))
    }
  }
  for (let i = 0; i < writes.length; i += 200) await prisma.$transaction(writes.slice(i, i + 200))
}

export async function editionCounts(editionId: string) {
  const rows = await prisma.mailingEditionRecipient.findMany({
    where: { editionId },
    select: { email: true, personId: true, source: true, excluded: true, excludedReason: true, fromListKeys: true, alsoAddToListIds: true, status: true },
  })
  return rosterCounts(rows.map(toRow))
}

type EditionForSend = Prisma.MailingEditionGetPayload<{ include: { lists: { include: { list: true } } } }>

async function attachmentFor(edition: EditionForSend) {
  if (!edition.attachFile || !edition.attachmentPath) return undefined
  const admin = createAdminClient()
  const { data } = await admin.storage.from(MAILING_BUCKET).createSignedUrl(edition.attachmentPath, 60 * 60)
  if (!data?.signedUrl) throw new Error('Could not read the attached file from storage')
  return [{ filename: edition.attachmentName ?? 'report.pdf', path: data.signedUrl }]
}

async function mergeFor(personId: string | null, bodyHtml = '') {
  if (!personId) return { firstName: null, orgName: null }
  const p = await prisma.crmPerson.findUnique({
    where: { id: personId },
    select: { firstName: true, fullName: true, affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { id: true, name: true, canonicalNameNormalized: true } } } } },
  })
  const first = p?.firstName || p?.fullName?.split(/\s+/)[0] || null
  const org = p?.affiliations[0]?.org ?? null
  // A name that is really an address ("jason.wendle") isn't a first name.
  const out: { firstName: string | null; orgName: string | null; claimUrl?: string | null; communityStat?: string | null } = {
    firstName: first && !first.includes('.') && !first.includes('@') ? first : null,
    orgName: org?.name ?? null,
  }
  // The organization's page and its community figure are looked up only when the message uses them. Both are empty when we have none.
  if (org && /\{\{\s*claimUrl\s*\}\}/.test(bodyHtml)) out.claimUrl = claimUrlFor(org.canonicalNameNormalized)
  if (org && /\{\{\s*communityStat\s*\}\}/.test(bodyHtml)) out.communityStat = communityStatSentence(await communityStatsFor({ crmOrgId: org.id }))
  return out
}

export function reportLinkFor(edition: { key: string; reportUrl: string | null; attachmentPath: string | null }): string | null {
  return edition.reportUrl?.trim() || (edition.attachmentPath ? fileUrlFor(edition.key) : null)
}

// Who an edition is for, from the lists it goes to. Mixed or unmapped lists
// (investors, friends and family, the monthly update) read as a general update.
function audienceForEdition(edition: EditionForSend): EmailAudience {
  const keys = new Set(edition.lists.map((l) => l.list.key))
  if (keys.size !== 1) return 'general'
  const [key] = [...keys]
  if (key === 'candidates' || key === 'candidate_updates') return 'candidate'
  if (key === 'coaches') return 'coach'
  if (key === 'recruiters') return 'recruiter'
  if (key === 'employers') return 'employer'
  if (key === 'higher_ed' || key === 'workforce' || key === 'bd_partners' || key === 'research_partners') return 'organization'
  return 'general'
}

async function sendOne(
  resend: Resend,
  edition: EditionForSend,
  to: { email: string; personId: string | null; recipientId: string | null },
  settings: Awaited<ReturnType<typeof getMailingSettings>>,
  attachments: Awaited<ReturnType<typeof attachmentFor>>,
  subjectPrefix = '',
) {
  const token = makeUnsubscribeToken(to.email, edition.id)
  const unsubscribeUrl = `${appUrl()}/updates/unsubscribe/${token}`
  const rendered = renderEmail({
    bodyHtml: edition.bodyHtml,
    previewText: edition.previewText,
    reportUrl: reportLinkFor(edition),
    merge: { ...(await mergeFor(to.personId, edition.bodyHtml)), reportUrl: null },
    footerText: settings.footerText,
    postalAddress: settings.postalAddress || '[postal address not set]',
    unsubscribeUrl,
  })
  const audience = audienceForEdition(edition)
  // Our own links carry this recipient's id so a visit names who it was sent to (not for a test send).
  const html = to.recipientId ? tagMailingLinks(withAudienceHtml(audience, rendered.html), to.recipientId, 'html') : withAudienceHtml(audience, rendered.html)
  const text = to.recipientId ? tagMailingLinks(withAudienceText(audience, rendered.text), to.recipientId, 'text') : withAudienceText(audience, rendered.text)
  const fromName = edition.lists.length === 1 ? edition.lists[0].list.defaultFromName || settings.fromName : settings.fromName
  return resend.emails.send({
    from: `${fromName} <${settings.fromEmail}>`,
    replyTo: settings.replyTo,
    to: to.email,
    // Layoff outreach copies the owner on every send (edition.bccEmail); never on a test or seed send.
    ...(edition.bccEmail && to.recipientId ? { bcc: [edition.bccEmail] } : {}),
    subject: `${subjectPrefix}${edition.subject}`.slice(0, 200),
    html,
    text,
    attachments,
    headers: {
      'List-Unsubscribe': `<mailto:${settings.replyTo}?subject=unsubscribe>, <${appUrl()}/api/mailing/unsubscribe/${token}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
    tags: [
      { name: 'kind', value: 'mailing_edition' },
      { name: 'edition', value: edition.key.replace(/[^a-zA-Z0-9_-]/g, '_') },
      ...(to.recipientId ? [{ name: 'recipient', value: to.recipientId }] : []),
    ],
  })
}

/** "Send test to me": the real email, to the test address only, marked [Test]. */
export async function sendTestEmail(editionId: string): Promise<{ ok: boolean; message: string }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, message: 'RESEND_API_KEY is not set, so nothing can be sent.' }
  const edition = await prisma.mailingEdition.findUniqueOrThrow({ where: { id: editionId }, include: { lists: { include: { list: true } } } })
  if (!edition.subject.trim() || !edition.bodyHtml.trim()) return { ok: false, message: 'Add a subject and a message first.' }
  const settings = await getMailingSettings()
  const personId = (await prisma.crmPerson.findFirst({ where: { email: { equals: settings.testEmail, mode: 'insensitive' }, deletedAt: null }, select: { id: true } }))?.id ?? null
  const { error } = await sendOne(createResend(process.env.RESEND_API_KEY), edition, { email: settings.testEmail, personId, recipientId: null }, settings, await attachmentFor(edition), '[Test] ')
  if (error) return { ok: false, message: `Resend refused the test: ${error.message}` }
  return { ok: true, message: `Test sent to ${settings.testEmail}.` }
}

/** Sends the real email to each seed inbox (Gmail, Outlook, Yahoo...) marked [Seed], to see whether it lands in the inbox, promotions or spam. */
export async function sendSeedTest(editionId: string): Promise<{ ok: boolean; message: string; sentTo: string[] }> {
  if (!process.env.RESEND_API_KEY) return { ok: false, message: 'RESEND_API_KEY is not set, so nothing can be sent.', sentTo: [] }
  const edition = await prisma.mailingEdition.findUniqueOrThrow({ where: { id: editionId }, include: { lists: { include: { list: true } } } })
  if (!edition.subject.trim() || !edition.bodyHtml.trim()) return { ok: false, message: 'Add a subject and a message first.', sentTo: [] }
  const settings = await getMailingSettings()
  const seeds = Array.from(new Set(settings.seedEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)))
  if (seeds.length === 0) return { ok: false, message: 'No seed inboxes yet. Add them under Sender settings on the Mailing lists page.', sentTo: [] }
  const resend = createResend(process.env.RESEND_API_KEY)
  const attachments = await attachmentFor(edition)
  const sentTo: string[] = []
  const failed: string[] = []
  for (const email of seeds) {
    const { error } = await sendOne(resend, edition, { email, personId: null, recipientId: null }, settings, attachments, '[Seed] ')
    if (error) failed.push(`${email} (${error.message})`)
    else sentTo.push(email)
  }
  const message = `${sentTo.length ? `Seed test sent to ${sentTo.join(', ')}. Check each inbox in a few minutes: inbox, promotions or spam.` : 'Nothing was sent.'}${failed.length ? ` Refused: ${failed.join('; ')}.` : ''}`
  return { ok: sentTo.length > 0 && failed.length === 0, message, sentTo }
}

/** Midnight at the start of the current Eastern day, as an instant. */
function startOfEasternDay(now: Date): Date {
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  return new Date(now.getTime() - (et.getHours() * 3_600_000 + et.getMinutes() * 60_000 + et.getSeconds() * 1000 + et.getMilliseconds()))
}

/**
 * Sends the next slice of every edition that's due, within the hourly rate and the daily cap.
 * Called by the cron every five minutes and right after "Send now". Safe to
 * run concurrently: each recipient is claimed with a conditional update
 * before it's sent, so two runs never mail the same person.
 */
/** Owner rule (2026-11-11): list email goes out 7:00 a.m. to 5:00 p.m. Eastern only; the rest waits for 7:00 the next morning. */
export function inSendWindow(now: Date): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hourCycle: 'h23' }).format(now))
  return hour >= 7 && hour < 17
}

/**
 * Owner rule (2026-11-13): layoff outreach goes out on weekdays, 8:00 a.m. to 12:00 p.m. Eastern only. A layoff found overnight
 * (the alert reaches Justin at any hour) waits in its edition and sends the next morning at 8:00. Narrower than inSendWindow,
 * which still gates every send.
 */
export const LAYOFF_OUTREACH_CAMPAIGN = 'layoff_outreach'
export function inLayoffSendWindow(now: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(now)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '-1')
  return !['Sat', 'Sun'].includes(weekday) && hour >= 8 && hour < 12
}

export async function runSendBatch(maxThisRun = 25): Promise<{ sent: number; failed: number; editions: number }> {
  if (!process.env.RESEND_API_KEY) return { sent: 0, failed: 0, editions: 0 }
  if (!inSendWindow(new Date())) return { sent: 0, failed: 0, editions: 0 }
  const now = new Date()
  // Scheduled editions whose time has come start sending.
  const due = await prisma.mailingEdition.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } }, select: { id: true } })
  for (const d of due) await startSending(d.id)

  const settings = await getMailingSettings()
  const sentLastHour = await prisma.mailingEditionRecipient.count({ where: { sentAt: { gte: new Date(now.getTime() - 3_600_000) } } })
  // The daily cap keeps the volume from the sending domain growing gradually (a young domain that jumps from 24 to 1,600 a day looks like spam).
  const sentToday = await prisma.mailingEditionRecipient.count({ where: { sentAt: { gte: startOfEasternDay(now) } } })
  let budget = Math.min(maxThisRun, Math.max(0, settings.ratePerHour - sentLastHour), Math.max(0, settings.dailyCap - sentToday))

  const editions = await prisma.mailingEdition.findMany({
    where: { status: 'SENDING' }, orderBy: { sendStartedAt: 'asc' }, include: { lists: { include: { list: true } } },
  })
  const resend = createResend(process.env.RESEND_API_KEY)
  let sent = 0
  let failed = 0
  const dne = await doNotEmailPeople()
  const layoffWindowOpen = inLayoffSendWindow(now)
  for (const edition of editions) {
    // Layoff outreach waits for its own 8 a.m. to noon weekday window; it stays SENDING with its recipients pending.
    if (edition.campaign === LAYOFF_OUTREACH_CAMPAIGN && !layoffWindowOpen) continue
    const attachments = budget > 0 ? await attachmentFor(edition) : undefined
    while (budget > 0) {
      const next = await prisma.mailingEditionRecipient.findFirst({
        where: { editionId: edition.id, status: 'PENDING', excluded: false }, orderBy: [{ attempts: 'asc' }, { email: 'asc' }],
      })
      if (!next) break
      const suppressed = (await prisma.mailingSuppression.findUnique({ where: { email: next.email } })) || (next.personId && dne.personIds.has(next.personId))
      if (suppressed) {
        await prisma.mailingEditionRecipient.update({ where: { id: next.id }, data: { status: 'SKIPPED', excluded: true, excludedReason: 'suppressed' } })
        continue
      }
      // Claim it: only the run that moves attempts from n to n+1 sends.
      const claimed = await prisma.mailingEditionRecipient.updateMany({
        where: { id: next.id, status: 'PENDING', attempts: next.attempts }, data: { attempts: { increment: 1 } },
      })
      if (claimed.count === 0) continue
      budget--
      try {
        const { data, error } = await sendOne(resend, edition, { email: next.email, personId: next.personId, recipientId: next.id }, settings, attachments)
        if (error || !data) throw new Error(error?.message ?? 'no response from Resend')
        await recordSent(edition, next.id, data.id)
        sent++
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e)
        await prisma.mailingEditionRecipient.update({
          where: { id: next.id },
          data: { error: message.slice(0, 500), ...(next.attempts + 1 >= MAX_ATTEMPTS ? { status: 'FAILED' } : {}) },
        })
        if (next.attempts + 1 >= MAX_ATTEMPTS) failed++
      }
    }
    const remaining = await prisma.mailingEditionRecipient.count({ where: { editionId: edition.id, status: 'PENDING', excluded: false } })
    if (remaining === 0) {
      const done = await prisma.mailingEdition.updateMany({ where: { id: edition.id, status: 'SENDING' }, data: { status: 'SENT', sentAt: new Date() } })
      if (done.count) {
        const counts = await prisma.mailingEditionRecipient.groupBy({ by: ['status'], where: { editionId: edition.id }, _count: true })
        captureServerEvent('system', 'mailing_edition_completed', {
          editionId: edition.id, editionKey: edition.key, isReport: edition.isReport,
          ...Object.fromEntries(counts.map((c) => [c.status.toLowerCase(), c._count])),
        })
      }
    }
  }
  return { sent, failed, editions: editions.length }
}

async function recordSent(edition: EditionForSend, recipientId: string, resendEmailId: string) {
  const r = await prisma.mailingEditionRecipient.update({
    where: { id: recipientId },
    data: { status: 'SENT', sentAt: new Date(), resendEmailId, error: null },
  })
  // Added for this send with "also add to list(s)": joined once it went out.
  if (r.source === 'ADDED_THIS_EDITION' && r.alsoAddToListIds.length) {
    await addToLists({ email: r.email, personId: r.personId, listIds: r.alsoAddToListIds, addedVia: 'ADDED_BY_ADMIN', consentNote: `Added with ${edition.title}`, addedByEmail: edition.createdByEmail })
  }
  // On the person's CRM history like a segment broadcast, so what they were
  // sent sits beside one-to-one mail and last-contacted stays honest. Opens,
  // clicks and replies are read off the recipient row (see mailingSourceRef).
  if (r.personId) {
    const existing = await prisma.crmActivity.findUnique({ where: { type_sourceRef: { type: 'BROADCAST_SENT', sourceRef: mailingSourceRef(r.id) } }, select: { id: true } })
    if (!existing) {
      await prisma.crmActivity.create({
        data: {
          type: 'BROADCAST_SENT', direction: 'OUTBOUND', personId: r.personId, occurredAt: r.sentAt!,
          subject: edition.subject, body: edition.title, isAutoLogged: true,
          sourceRef: mailingSourceRef(r.id), loggedByEmail: edition.createdByEmail,
        },
      })
      await prisma.crmPerson.update({ where: { id: r.personId }, data: { lastTouchedAt: r.sentAt!, touchCount: { increment: 1 } } })
    }
  }
  if (edition.isReport && edition.reportKey && r.personId) {
    await prisma.crmReportSend.upsert({
      where: { personId_editionKey: { personId: r.personId, editionKey: edition.reportKey } },
      create: { personId: r.personId, editionKey: edition.reportKey, method: 'AUTOMATED', channel: 'EMAIL', sentAt: r.sentAt!, editionRecipientId: r.id, subject: edition.subject },
      // A manual row upgrades to automated; never the other way.
      update: { method: 'AUTOMATED', channel: 'EMAIL', sentAt: r.sentAt!, editionRecipientId: r.id, subject: edition.subject },
    })
  }
}

/** Freezes the roster and starts sending. */
export async function startSending(editionId: string) {
  await syncEditionRoster(editionId)
  await prisma.mailingEdition.updateMany({
    where: { id: editionId, status: { in: ['DRAFT', 'SCHEDULED'] } },
    data: { status: 'SENDING', sendStartedAt: new Date() },
  })
}
