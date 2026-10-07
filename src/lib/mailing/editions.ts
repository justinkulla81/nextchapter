import 'server-only'
import { Resend } from 'resend'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/posthog/server'
import { computeRoster, rosterCounts, type RosterRow } from './roster'
import { renderEmail } from './render'
import { makeUnsubscribeToken } from './unsubscribe-token'
import { addToLists, getMailingSettings, syncWebsiteSignups } from './lists'

export const MAILING_BUCKET = 'mailing-files'
export const ATTACH_WARN_BYTES = 5 * 1024 * 1024
const MAX_ATTEMPTS = 2 // the first try, then one retry

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com').replace(/\/$/, '')
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
  const manual = edition.isReport && edition.reportKey
    ? await prisma.crmReportSend.findMany({ where: { editionKey: edition.reportKey, method: 'MANUAL' }, select: { personId: true, sentAt: true } })
    : []

  const next = computeRoster({
    members: members.map((m) => ({ email: m.email, personId: m.personId, listKey: keyById.get(m.listId)!, status: m.status })),
    existing: edition.recipients.map(toRow),
    suppressed,
    manualSends: new Map(manual.map((m) => [m.personId, m.sentAt])),
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

async function mergeFor(personId: string | null) {
  if (!personId) return { firstName: null, orgName: null }
  const p = await prisma.crmPerson.findUnique({
    where: { id: personId },
    select: { firstName: true, fullName: true, affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true } } } } },
  })
  const first = p?.firstName || p?.fullName?.split(/\s+/)[0] || null
  // A name that is really an address ("jason.wendle") isn't a first name.
  return { firstName: first && !first.includes('.') && !first.includes('@') ? first : null, orgName: p?.affiliations[0]?.org.name ?? null }
}

export function reportLinkFor(edition: { key: string; reportUrl: string | null; attachmentPath: string | null }): string | null {
  return edition.reportUrl?.trim() || (edition.attachmentPath ? fileUrlFor(edition.key) : null)
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
  const { html, text } = renderEmail({
    bodyHtml: edition.bodyHtml,
    previewText: edition.previewText,
    reportUrl: reportLinkFor(edition),
    merge: { ...(await mergeFor(to.personId)), reportUrl: null },
    footerText: settings.footerText,
    postalAddress: settings.postalAddress || '[postal address not set]',
    unsubscribeUrl,
  })
  const fromName = edition.lists.length === 1 ? edition.lists[0].list.defaultFromName || settings.fromName : settings.fromName
  return resend.emails.send({
    from: `${fromName} <${settings.fromEmail}>`,
    replyTo: settings.replyTo,
    to: to.email,
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
  const { error } = await sendOne(new Resend(process.env.RESEND_API_KEY), edition, { email: settings.testEmail, personId, recipientId: null }, settings, await attachmentFor(edition), '[Test] ')
  if (error) return { ok: false, message: `Resend refused the test: ${error.message}` }
  return { ok: true, message: `Test sent to ${settings.testEmail}.` }
}

/**
 * Sends the next slice of every edition that's due, within the hourly rate.
 * Called by the cron every five minutes and right after "Send now". Safe to
 * run concurrently: each recipient is claimed with a conditional update
 * before it's sent, so two runs never mail the same person.
 */
export async function runSendBatch(maxThisRun = 25): Promise<{ sent: number; failed: number; editions: number }> {
  if (!process.env.RESEND_API_KEY) return { sent: 0, failed: 0, editions: 0 }
  const now = new Date()
  // Scheduled editions whose time has come start sending.
  const due = await prisma.mailingEdition.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now } }, select: { id: true } })
  for (const d of due) await startSending(d.id)

  const settings = await getMailingSettings()
  const sentLastHour = await prisma.mailingEditionRecipient.count({ where: { sentAt: { gte: new Date(now.getTime() - 3_600_000) } } })
  let budget = Math.min(maxThisRun, Math.max(0, settings.ratePerHour - sentLastHour))

  const editions = await prisma.mailingEdition.findMany({
    where: { status: 'SENDING' }, orderBy: { sendStartedAt: 'asc' }, include: { lists: { include: { list: true } } },
  })
  const resend = new Resend(process.env.RESEND_API_KEY)
  let sent = 0
  let failed = 0
  for (const edition of editions) {
    const attachments = budget > 0 ? await attachmentFor(edition) : undefined
    while (budget > 0) {
      const next = await prisma.mailingEditionRecipient.findFirst({
        where: { editionId: edition.id, status: 'PENDING', excluded: false }, orderBy: [{ attempts: 'asc' }, { email: 'asc' }],
      })
      if (!next) break
      const suppressed = await prisma.mailingSuppression.findUnique({ where: { email: next.email } })
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
