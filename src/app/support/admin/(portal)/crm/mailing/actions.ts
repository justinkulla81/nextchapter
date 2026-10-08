'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import type { CrmReportSendChannel, MailingAddedVia, MailingCadence } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { sanitizeBodyHtml } from '@/lib/mailing/render'
import { normalizeListEmail } from '@/lib/mailing/rules'
import { addManyToLists, addToLists, getMailingSettings, unsubscribe, type AddResult, doNotEmailPeople, setDoNotEmail } from '@/lib/mailing/lists'
import { audienceFacets, audienceWhere, describeAudience, isEmptyAudience, EMPTY_AUDIENCE, type AudienceFilter } from '@/lib/mailing/audience'
import { PERSON_ROLES, PERSON_ROLE_LABELS, PRIORITY_TIERS } from '@/lib/crm/labels'
import { markReportManual } from '@/lib/mailing/tracking'
import { createEditionDraft } from '@/lib/mailing/drafts'
import { PLACEHOLDER_RE } from '@/lib/mailing/prefill'
import { isCadence } from '@/lib/mailing/cadence'
import {
  ATTACH_WARN_BYTES, MAILING_BUCKET, editionCounts, ensureBucket, runSendBatch,
  sendTestEmail, startSending, syncEditionRoster, earlierVersionSends,
} from '@/lib/mailing/editions'

const BASE = '/support/admin/crm/mailing'
const CHANNELS: CrmReportSendChannel[] = ['EMAIL', 'LINKEDIN', 'IN_PERSON', 'OTHER']

async function admin() {
  const user = await requireAdmin()
  return (user.email ?? 'admin').toLowerCase()
}

function summarize(r: AddResult): string {
  const parts: string[] = []
  if (r.added.length) parts.push(`Added to ${r.added.map((a) => a.listName).join(', ')}.`)
  if (r.blocked.length) parts.push(`Not added: ${r.blocked.map((b) => `${b.listName} (${b.reason})`).join('; ')}.`)
  return parts.join(' ') || 'Nothing to change — already on those lists.'
}

// ── Editions ─────────────────────────────────────────────────────────────────

/**
 * "New edition" on a list: a prefilled draft (see lib/mailing/prefill) whose
 * roster is the lists' members, ready to tailor and approve.
 */
export async function createEdition(formData: FormData) {
  const by = await admin()
  const listIds = formData.getAll('listId').map(String).filter(Boolean)
  if (listIds.length === 0) return
  const id = await createEditionDraft({ listIds, by })
  redirect(`${BASE}/editions/${id}`)
}

export interface EditionDraft {
  title: string
  key: string
  subject: string
  previewText: string
  bodyHtml: string
  isReport: boolean
  reportKey: string
  reportUrl: string
  attachFile: boolean
  listIds: string[]
}

export async function saveEdition(id: string, d: EditionDraft): Promise<{ ok: boolean; message: string }> {
  await admin()
  const edition = await prisma.mailingEdition.findUniqueOrThrow({ where: { id }, include: { lists: true } })
  if (edition.status === 'SENDING' || edition.status === 'SENT') return { ok: false, message: 'This edition has already gone out, so it can no longer be edited.' }
  const key = d.key.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
  if (!key) return { ok: false, message: 'Give the edition a key, like monthly-2026-10.' }
  if (key !== edition.key && (await prisma.mailingEdition.findUnique({ where: { key } }))) {
    return { ok: false, message: `Another edition already uses the key "${key}". Pick a different one.` }
  }
  const reportKey = d.isReport ? d.reportKey.trim() : ''
  if (d.isReport && !/^20\d{2}-(0[1-9]|1[0-2])$/.test(reportKey)) {
    return { ok: false, message: 'A report needs its month as YYYY-MM, like 2026-10.' }
  }
  if (d.listIds.length === 0) return { ok: false, message: 'Choose at least one list to send to.' }
  const listsChanged = edition.lists.map((l) => l.listId).sort().join() !== [...d.listIds].sort().join()
  const reportChanged = edition.reportKey !== (reportKey || null)

  await prisma.$transaction([
    prisma.mailingEdition.update({
      where: { id },
      data: {
        title: d.title.trim() || edition.title, key, subject: d.subject.trim().slice(0, 200),
        previewText: d.previewText.trim() || null, bodyHtml: sanitizeBodyHtml(d.bodyHtml),
        isReport: d.isReport, reportKey: reportKey || null, reportUrl: d.reportUrl.trim() || null, attachFile: d.attachFile,
      },
    }),
    ...(listsChanged
      ? [
          prisma.mailingEditionList.deleteMany({ where: { editionId: id } }),
          prisma.mailingEditionList.createMany({ data: d.listIds.map((listId) => ({ editionId: id, listId })) }),
        ]
      : []),
  ])
  // A different report month changes who already has it by hand.
  if (reportChanged) {
    await prisma.mailingEditionRecipient.updateMany({ where: { editionId: id, excludedReason: 'already_sent_manually' }, data: { excluded: false, excludedReason: null } })
    await prisma.mailingEditionRecipient.deleteMany({ where: { editionId: id, source: 'BASE', status: 'PENDING' } })
  }
  if (listsChanged || reportChanged) await syncEditionRoster(id)
  revalidatePath(`${BASE}/editions/${id}`)
  return { ok: true, message: 'Saved.' }
}

/**
 * "Make a copy": a new draft with the same text, report, file and lists, to
 * edit and send to other people. It joins the original's group of versions,
 * and anyone a version already reached starts unchecked.
 */
export async function duplicateEdition(id: string) {
  const by = await admin()
  const src = await prisma.mailingEdition.findUniqueOrThrow({ where: { id }, include: { lists: { select: { listId: true } } } })
  const rootId = src.versionOfId ?? src.id
  const root = rootId === src.id ? src : await prisma.mailingEdition.findUniqueOrThrow({ where: { id: rootId } })
  const n = (await prisma.mailingEdition.count({ where: { OR: [{ id: rootId }, { versionOfId: rootId }] } })) + 1

  let key = `${root.key}-v${n}`
  for (let i = n + 1; await prisma.mailingEdition.findUnique({ where: { key } }); i++) key = `${root.key}-v${i}`

  // Its own copy of the file: removing an attachment or deleting a draft
  // deletes the stored file, which must never take the original's with it.
  let attachmentPath: string | null = null
  if (src.attachmentPath) {
    const storage = (await ensureBucket()).storage.from(MAILING_BUCKET)
    const to = `editions/${key}/${Date.now()}-${(src.attachmentName ?? 'report.pdf').replace(/[^a-zA-Z0-9._-]+/g, '-')}`
    const { error } = await storage.copy(src.attachmentPath, to)
    if (!error) attachmentPath = to
  }

  const copy = await prisma.mailingEdition.create({
    data: {
      key,
      title: `${root.title} — version ${n}`,
      isReport: src.isReport,
      reportKey: src.reportKey,
      subject: src.subject,
      previewText: src.previewText,
      bodyHtml: src.bodyHtml,
      attachmentPath,
      attachmentName: attachmentPath ? src.attachmentName : null,
      attachmentBytes: attachmentPath ? src.attachmentBytes : null,
      attachFile: attachmentPath ? src.attachFile : false,
      reportUrl: src.reportUrl,
      versionOfId: rootId,
      createdByEmail: by,
      lists: { create: src.lists.map((l) => ({ listId: l.listId })) },
    },
  })
  await syncEditionRoster(copy.id)
  captureServerEvent(by, 'mailing_edition_duplicated', { editionId: copy.id, sourceId: src.id, rootId, version: n, fileCopied: !!attachmentPath || !src.attachmentPath })
  redirect(`${BASE}/editions/${copy.id}`)
}

export async function deleteDraftEdition(id: string) {
  const by = await admin()
  const e = await prisma.mailingEdition.findUniqueOrThrow({ where: { id }, select: { status: true, attachmentPath: true } })
  if (e.status !== 'DRAFT') return
  if (e.attachmentPath) await (await ensureBucket()).storage.from(MAILING_BUCKET).remove([e.attachmentPath])
  await prisma.mailingEdition.delete({ where: { id } })
  captureServerEvent(by, 'mailing_edition_deleted', { editionId: id })
  redirect(BASE)
}

/** A signed upload URL, so the PDF goes straight to storage (it can be larger than a request body allows). */
export async function createAttachmentUpload(id: string, filename: string, bytes: number) {
  await admin()
  if (!/\.pdf$/i.test(filename)) return { ok: false as const, message: 'Upload a PDF.' }
  if (bytes > 25 * 1024 * 1024) return { ok: false as const, message: 'That file is over 25 MB. Compress it and try again.' }
  const edition = await prisma.mailingEdition.findUniqueOrThrow({ where: { id }, select: { key: true } })
  const path = `editions/${edition.key}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]+/g, '-')}`
  const storage = (await ensureBucket()).storage.from(MAILING_BUCKET)
  const { data, error } = await storage.createSignedUploadUrl(path)
  if (error || !data) return { ok: false as const, message: `Storage refused the upload: ${error?.message ?? 'unknown error'}` }
  return { ok: true as const, path, token: data.token }
}

export async function confirmAttachment(id: string, path: string, filename: string, bytes: number) {
  const by = await admin()
  const prev = await prisma.mailingEdition.findUniqueOrThrow({ where: { id }, select: { attachmentPath: true } })
  await prisma.mailingEdition.update({ where: { id }, data: { attachmentPath: path, attachmentName: filename, attachmentBytes: bytes } })
  if (prev.attachmentPath && prev.attachmentPath !== path) {
    await (await ensureBucket()).storage.from(MAILING_BUCKET).remove([prev.attachmentPath])
  }
  captureServerEvent(by, 'mailing_attachment_uploaded', { editionId: id, bytes, overWarn: bytes > ATTACH_WARN_BYTES })
  revalidatePath(`${BASE}/editions/${id}`)
}

export async function removeAttachment(id: string) {
  await admin()
  const e = await prisma.mailingEdition.findUniqueOrThrow({ where: { id }, select: { attachmentPath: true } })
  if (e.attachmentPath) await (await ensureBucket()).storage.from(MAILING_BUCKET).remove([e.attachmentPath])
  await prisma.mailingEdition.update({ where: { id }, data: { attachmentPath: null, attachmentName: null, attachmentBytes: null, attachFile: false } })
  revalidatePath(`${BASE}/editions/${id}`)
}

// ── Roster ───────────────────────────────────────────────────────────────────

export async function setRecipientsExcluded(editionId: string, recipientIds: string[], excluded: boolean) {
  const by = await admin()
  await prisma.mailingEditionRecipient.updateMany({
    where: { editionId, id: { in: recipientIds }, status: 'PENDING', edition: { status: { in: ['DRAFT', 'SCHEDULED'] } } },
    data: { excluded, excludedReason: excluded ? 'unchecked' : null },
  })
  captureServerEvent(by, 'mailing_recipients_toggled', { editionId, count: recipientIds.length, excluded })
  revalidatePath(`${BASE}/editions/${editionId}`)
  return editionCounts(editionId)
}

export async function searchPeopleForEdition(q: string) {
  await admin()
  const query = q.trim()
  if (query.length < 2) return []
  const people = await prisma.crmPerson.findMany({
    where: {
      deletedAt: null, email: { not: null }, id: { notIn: [...(await doNotEmailPeople()).personIds] },
      OR: [
        { fullName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } },
        { affiliations: { some: { org: { name: { contains: query, mode: 'insensitive' } } } } },
      ],
    },
    orderBy: [{ priority: { sort: 'asc', nulls: 'last' } }, { priorityScore: 'desc' }],
    take: 8,
    select: { id: true, fullName: true, email: true, affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true } } } } },
  })
  return people.map((p) => ({ id: p.id, name: p.fullName, email: p.email!, org: p.affiliations[0]?.org.name ?? null }))
}

export async function addEditionRecipient(editionId: string, personId: string, alsoAddToListIds: string[]) {
  const by = await admin()
  const [edition, person] = await Promise.all([
    prisma.mailingEdition.findUniqueOrThrow({ where: { id: editionId }, select: { status: true } }),
    prisma.crmPerson.findUniqueOrThrow({ where: { id: personId }, select: { email: true, fullName: true } }),
  ])
  if (edition.status !== 'DRAFT' && edition.status !== 'SCHEDULED') return { ok: false, message: 'This edition has already gone out.' }
  const email = normalizeListEmail(person.email)
  if (!email) return { ok: false, message: `${person.fullName} has no email address on file. Add one on their page first.` }
  const suppressed = await prisma.mailingSuppression.findUnique({ where: { email } })
  if (suppressed?.reason === 'DO_NOT_EMAIL' || (await doNotEmailPeople()).personIds.has(personId)) {
    return { ok: false, message: `${person.fullName} is marked Do not email on their CRM record.` }
  }
  if (suppressed) return { ok: false, message: `${person.fullName}'s address ${suppressed.reason === 'COMPLAINED' ? 'marked an email as spam' : 'bounced'}, so it is never mailed again.` }
  const existing = await prisma.mailingEditionRecipient.findUnique({ where: { editionId_email: { editionId, email } } })
  if (existing) {
    if (existing.excluded) await prisma.mailingEditionRecipient.update({ where: { id: existing.id }, data: { excluded: false, excludedReason: null } })
  } else {
    await prisma.mailingEditionRecipient.create({
      data: { editionId, email, personId, source: 'ADDED_THIS_EDITION', alsoAddToListIds },
    })
  }
  captureServerEvent(by, 'mailing_recipient_added', { editionId, personId, alsoAddToLists: alsoAddToListIds.length })
  revalidatePath(`${BASE}/editions/${editionId}`)
  return { ok: true, message: existing ? `${person.fullName} is on the roster.` : `Added ${person.fullName} for this send.` }
}

export async function removeAddedRecipient(editionId: string, recipientId: string) {
  await admin()
  await prisma.mailingEditionRecipient.deleteMany({ where: { id: recipientId, editionId, source: 'ADDED_THIS_EDITION', status: 'PENDING' } })
  revalidatePath(`${BASE}/editions/${editionId}`)
}

export async function refreshRoster(editionId: string) {
  await admin()
  await syncEditionRoster(editionId)
  revalidatePath(`${BASE}/editions/${editionId}`)
}

// ── Sending ──────────────────────────────────────────────────────────────────

export async function sendTest(editionId: string) {
  const by = await admin()
  const r = await sendTestEmail(editionId)
  captureServerEvent(by, 'mailing_test_sent', { editionId, ok: r.ok })
  return r
}

async function readyToSend(editionId: string, confirmCount: number) {
  const [edition, settings] = await Promise.all([
    prisma.mailingEdition.findUniqueOrThrow({ where: { id: editionId }, include: { lists: true } }),
    getMailingSettings(),
  ])
  if (edition.status === 'SENDING' || edition.status === 'SENT') return 'This edition has already gone out.'
  if (!edition.subject.trim() || !edition.bodyHtml.trim()) return 'Add a subject and a message first.'
  if (PLACEHOLDER_RE.test(edition.subject) || PLACEHOLDER_RE.test(edition.bodyHtml)) {
    return 'The draft still has a [[Write: …]] note in it. Replace it with your own words, save, then approve.'
  }
  if (!settings.postalAddress.trim()) return 'Add your postal address in Mailing lists → Sender settings first. The law requires one in every list email.'
  if (!process.env.RESEND_API_KEY) return 'RESEND_API_KEY is not set, so nothing can be sent.'
  await syncEditionRoster(editionId)
  const counts = await editionCounts(editionId)
  if (counts.total === 0) return 'Nobody is on the roster.'
  if (counts.total !== confirmCount) return `The roster changed to ${counts.total} while you were confirming. Check it and confirm again.`
  return null
}

export async function sendNow(editionId: string, confirmCount: number) {
  const by = await admin()
  const problem = await readyToSend(editionId, confirmCount)
  if (problem) return { ok: false, message: problem }
  await startSending(editionId)
  captureServerEvent(by, 'mailing_edition_send_started', { editionId, recipients: confirmCount, scheduled: false })
  // The first slice goes now; the cron sends the rest within the hourly rate.
  after(() => runSendBatch(25).catch((e) => console.error('Mailing send batch failed', e)))
  revalidatePath(`${BASE}/editions/${editionId}`)
  return { ok: true, message: 'Sending. The first emails go now; the rest follow at your hourly rate.' }
}

export async function scheduleSend(editionId: string, confirmCount: number, atIso: string) {
  const by = await admin()
  const at = new Date(atIso)
  if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 60_000) return { ok: false, message: 'Pick a time at least a minute from now.' }
  const problem = await readyToSend(editionId, confirmCount)
  if (problem) return { ok: false, message: problem }
  await prisma.mailingEdition.update({ where: { id: editionId }, data: { status: 'SCHEDULED', scheduledAt: at } })
  captureServerEvent(by, 'mailing_edition_send_started', { editionId, recipients: confirmCount, scheduled: true, at: at.toISOString() })
  revalidatePath(`${BASE}/editions/${editionId}`)
  return { ok: true, message: `Scheduled for ${at.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/New_York' })} ET.` }
}

export async function cancelSchedule(editionId: string) {
  await admin()
  await prisma.mailingEdition.updateMany({ where: { id: editionId, status: 'SCHEDULED' }, data: { status: 'DRAFT', scheduledAt: null } })
  revalidatePath(`${BASE}/editions/${editionId}`)
}

// ── Lists and settings ───────────────────────────────────────────────────────

export async function saveList(formData: FormData) {
  const by = await admin()
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const data = {
    name,
    description: String(formData.get('description') ?? '').trim() || null,
    audience: String(formData.get('audience') ?? '').trim() || null,
    defaultFromName: String(formData.get('defaultFromName') ?? '').trim() || null,
    ...(isCadence(String(formData.get('cadence') ?? '')) ? { cadence: String(formData.get('cadence')) as MailingCadence } : {}),
  }
  if (id) {
    const before = await prisma.mailingList.findUnique({ where: { id }, select: { cadence: true, key: true } })
    await prisma.mailingList.update({ where: { id }, data })
    if (data.cadence && before && before.cadence !== data.cadence) {
      captureServerEvent(by, 'mailing_list_cadence_changed', { listId: id, key: before.key, from: before.cadence, to: data.cadence })
    }
  } else {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'list'
    let key = base
    for (let i = 2; await prisma.mailingList.findUnique({ where: { key } }); i++) key = `${base}_${i}`
    const max = await prisma.mailingList.aggregate({ _max: { sortOrder: true } })
    await prisma.mailingList.create({ data: { ...data, key, sortOrder: (max._max.sortOrder ?? 0) + 1 } })
    captureServerEvent(by, 'mailing_list_created', { key })
  }
  revalidatePath(`${BASE}/lists`)
  revalidatePath(BASE)
}

export async function setListActive(id: string, isActive: boolean) {
  const by = await admin()
  await prisma.mailingList.update({ where: { id }, data: { isActive } })
  captureServerEvent(by, isActive ? 'mailing_list_restored' : 'mailing_list_archived', { listId: id })
  revalidatePath(`${BASE}/lists`)
}

export async function saveSettings(formData: FormData) {
  await admin()
  const text = (k: string) => String(formData.get(k) ?? '').trim()
  const rate = Math.max(1, Math.min(2000, parseInt(text('ratePerHour'), 10) || 50))
  const data = {
    fromName: text('fromName') || 'Justin Kulla',
    fromEmail: text('fromEmail') || 'justin@updates.launchyournextchapter.com',
    replyTo: text('replyTo') || 'justin@launchyournextchapter.com',
    testEmail: text('testEmail') || 'justin@launchyournextchapter.com',
    ratePerHour: rate,
    footerText: text('footerText') || "Reply 'unsubscribe' or [click here] to remove yourself from future emails. NextChapter · {{postalAddress}}",
    postalAddress: text('postalAddress'),
  }
  await prisma.mailingSettings.upsert({ where: { id: 'singleton' }, create: { id: 'singleton', ...data }, update: data })
  revalidatePath(`${BASE}/lists`)
}

// ── People on lists ──────────────────────────────────────────────────────────

export async function addPersonToLists(personId: string, listIds: string[], opts: { repliedYes?: boolean; note?: string } = {}) {
  const by = await admin()
  const person = await prisma.crmPerson.findUniqueOrThrow({ where: { id: personId }, select: { email: true, fullName: true } })
  if (!person.email) return { ok: false, message: `${person.fullName} has no email address on file.` }
  const addedVia: MailingAddedVia = opts.repliedYes ? 'REPLIED_YES' : 'ADDED_BY_ADMIN'
  const r = await addToLists({ email: person.email, personId, listIds, addedVia, consentNote: opts.note, addedByEmail: by })
  captureServerEvent(by, 'mailing_person_added', { personId, added: r.added.length, blocked: r.blocked.length, addedVia })
  revalidatePath(`/support/admin/crm/people/${personId}`)
  for (const listId of listIds) revalidatePath(`${BASE}/lists/${listId}`)
  return { ok: r.added.length > 0 || r.blocked.length === 0, message: summarize(r) }
}

/**
 * Taking someone off a list by hand. An ACTIVE membership you added is just
 * removed (you may add them back later); one they unsubscribed from stays
 * on record as such.
 */
export async function removePersonFromList(personId: string, listId: string) {
  const by = await admin()
  const person = await prisma.crmPerson.findUniqueOrThrow({ where: { id: personId }, select: { email: true } })
  await prisma.mailingListMember.deleteMany({
    where: { listId, status: 'ACTIVE', OR: [{ personId }, ...(person.email ? [{ email: person.email.toLowerCase() }] : [])] },
  })
  captureServerEvent(by, 'mailing_person_removed', { personId, listId })
  revalidatePath(`/support/admin/crm/people/${personId}`)
}

/** Readership page: take one ACTIVE address off a list (it may not be linked to a person). */
export async function removeListMember(memberId: string) {
  const by = await admin()
  const m = await prisma.mailingListMember.findUnique({ where: { id: memberId }, select: { listId: true, personId: true, status: true } })
  if (!m || m.status !== 'ACTIVE') return
  await prisma.mailingListMember.delete({ where: { id: memberId } })
  captureServerEvent(by, 'mailing_person_removed', { personId: m.personId, listId: m.listId, from: 'readership' })
  revalidatePath(`${BASE}/lists/${m.listId}`)
}

// ── "Add to a mailing list?" cards ───────────────────────────────────────────

export async function answerPromptYes(personIds: string[], listIds: string[], repliedYes: boolean, note: string) {
  const by = await admin()
  const lines: string[] = []
  for (const personId of personIds) {
    const person = await prisma.crmPerson.findUnique({ where: { id: personId }, select: { email: true, fullName: true } })
    if (!person?.email) { lines.push(`${person?.fullName ?? 'Someone'}: no email address`); continue }
    const r = await addToLists({
      email: person.email, personId, listIds, addedVia: repliedYes ? 'REPLIED_YES' : 'ADDED_BY_ADMIN',
      consentNote: note || null, addedByEmail: by,
    })
    await prisma.mailingListPrompt.updateMany({ where: { personId }, data: { status: 'DONE', answeredAt: new Date(), answeredByEmail: by } })
    if (r.blocked.length) lines.push(`${person.fullName}: ${summarize(r)}`)
  }
  captureServerEvent(by, 'mailing_prompt_answered', { answer: 'yes', people: personIds.length, lists: listIds.length, repliedYes })
  revalidatePath('/support/admin/crm/home')
  revalidatePath(`${BASE}/queue`)
  return { ok: true, message: lines.length ? lines.join(' ') : `Added ${personIds.length === 1 ? 'them' : `${personIds.length} people`} to ${listIds.length} list${listIds.length === 1 ? '' : 's'}.` }
}

export async function answerPromptLater(personIds: string[], answer: 'snooze' | 'never') {
  const by = await admin()
  await prisma.mailingListPrompt.updateMany({
    where: { personId: { in: personIds } },
    data: answer === 'never'
      ? { status: 'NEVER', snoozedUntil: null, answeredAt: new Date(), answeredByEmail: by }
      : { status: 'SNOOZED', snoozedUntil: new Date(Date.now() + 90 * 86_400_000), answeredAt: new Date(), answeredByEmail: by },
  })
  captureServerEvent(by, 'mailing_prompt_answered', { answer, people: personIds.length })
  revalidatePath('/support/admin/crm/home')
  revalidatePath(`${BASE}/queue`)
}

// ── Report receipts ──────────────────────────────────────────────────────────

export async function markReportReceived(personIds: string[], editionKey: string, channel: string) {
  const by = await admin()
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(editionKey)) return { ok: false, message: 'Pick the report month (YYYY-MM).' }
  const ch = CHANNELS.includes(channel as CrmReportSendChannel) ? (channel as CrmReportSendChannel) : 'OTHER'
  let marked = 0
  let kept = 0
  for (const personId of personIds) {
    const r = await markReportManual({ personId, editionKey, channel: ch, sentAt: new Date(), markedByEmail: by })
    if (r === 'kept_automated') kept++
    else marked++
  }
  captureServerEvent(by, 'report_marked_received', { editionKey, channel: ch, people: personIds.length })
  for (const id of personIds.slice(0, 20)) revalidatePath(`/support/admin/crm/people/${id}`)
  revalidatePath('/support/admin/crm')
  return { ok: true, message: `Marked ${marked} as received${kept ? `; ${kept} already had it from the system` : ''}.` }
}

export async function unmarkReportReceived(personId: string, editionKey: string) {
  await admin()
  await prisma.crmReportSend.deleteMany({ where: { personId, editionKey, method: 'MANUAL' } })
  revalidatePath(`/support/admin/crm/people/${personId}`)
}

/** Bulk form action from the people list. */
export async function bulkMailingAction(formData: FormData) {
  const ids = formData.getAll('selected').map(String)
  const op = String(formData.get('mailingOp') ?? '')
  if (ids.length === 0) return { ok: false, message: 'Tick some people first.' }
  if (op === 'add') {
    const listIds = formData.getAll('bulkListId').map(String)
    if (listIds.length === 0) return { ok: false, message: 'Choose at least one list.' }
    return answerPromptYes(ids, listIds, false, '')
  }
  if (op === 'received') {
    return markReportReceived(ids, String(formData.get('bulkEditionKey') ?? ''), String(formData.get('bulkChannel') ?? 'OTHER'))
  }
  return { ok: false, message: 'Choose what to do.' }
}

// ── Unsubscribe replies ──────────────────────────────────────────────────────

export async function processUnsubscribeRequests(ids: string[]) {
  const by = await admin()
  const reqs = await prisma.mailingUnsubscribeRequest.findMany({ where: { id: { in: ids }, processedAt: null } })
  for (const r of reqs) {
    await unsubscribe(r.email, 'all', `a reply asking to be removed (${r.receivedAt.toISOString().slice(0, 10)})`)
    await prisma.mailingUnsubscribeRequest.update({ where: { id: r.id }, data: { processedAt: new Date(), processedBy: by } })
  }
  captureServerEvent(by, 'mailing_unsubscribe_requests_processed', { count: reqs.length })
  revalidatePath(`${BASE}/unsubscribes`)
  revalidatePath(BASE)
}

export async function dismissUnsubscribeRequest(id: string) {
  const by = await admin()
  await prisma.mailingUnsubscribeRequest.update({ where: { id }, data: { processedAt: new Date(), processedBy: `${by} (not an unsubscribe)` } })
  revalidatePath(`${BASE}/unsubscribes`)
}

// ── Groups: add or remove people by type, priority, organization, title ─────

export type AudienceOp = 'add_send' | 'remove_send' | 'add_lists' | 'remove_lists'

async function audiencePeople(filter: AudienceFilter) {
  const dne = await doNotEmailPeople()
  return prisma.crmPerson.findMany({
    where: audienceWhere(filter, [...dne.personIds]),
    select: { id: true, fullName: true, email: true, affiliations: { where: { isPrimary: true }, take: 1, select: { title: true, org: { select: { name: true } } } } },
    orderBy: [{ priority: { sort: 'asc', nulls: 'last' } }, { priorityScore: 'desc' }],
  })
}

/**
 * Who a group is, before acting on it: the count and a sample, plus how
 * many each option would give (each contact type, priority and email
 * history, with the other choices kept). Everyone counted has an email
 * address and isn't marked Do not email.
 */
export async function previewAudience(filter: AudienceFilter, ctx: { editionId?: string | null; skipEarlierVersions?: boolean } = {}) {
  await admin()
  const dne = [...(await doNotEmailPeople()).personIds]
  // With "leave out anyone an earlier version already emailed" ticked, those
  // people aren't in any number here: not the option counts, not the total.
  const reached = await reachedByEarlierVersions(ctx)
  const notReached = (email: string | null) => { const e = normalizeListEmail(email); return !e || !reached.has(e) }
  // ~hundreds of emailable people: load them once and count every option in
  // memory, rather than a query per option.
  const rows = await prisma.crmPerson.findMany({
    where: audienceWhere(EMPTY_AUDIENCE, dne),
    select: {
      email: true, roles: true, priority: true,
      affiliations: { where: { isCurrent: true }, select: { title: true, org: { select: { name: true } } } },
      _count: { select: { activities: { where: { type: 'EMAIL' } } } },
      activities: { where: { type: 'EMAIL', OR: [{ direction: 'INBOUND' }, { direction: 'OUTBOUND', needsReview: false }] }, select: { direction: true } },
    },
  })
  const people = rows.filter((p) => notReached(p.email)).map((p) => ({
    roles: p.roles, priority: p.priority,
    orgs: p.affiliations.map((a) => a.org.name), titles: p.affiliations.map((a) => a.title ?? '').filter(Boolean),
    sent: p.activities.filter((a) => a.direction === 'OUTBOUND').length,
    received: p.activities.filter((a) => a.direction === 'INBOUND').length,
    emailCount: p._count.activities,
  }))
  const facets = audienceFacets(people, filter, PERSON_ROLES, PRIORITY_TIERS)
  if (isEmptyAudience(filter)) return { facets, total: 0, doNotEmail: 0, earlierVersion: 0, sample: [] as { name: string; detail: string | null }[] }
  const [all, withDne] = await Promise.all([audiencePeople(filter), prisma.crmPerson.count({ where: audienceWhere(filter) })])
  const matched = all.filter((p) => notReached(p.email))
  return {
    facets,
    total: matched.length,
    doNotEmail: withDne - all.length,
    earlierVersion: all.length - matched.length,
    sample: matched.slice(0, 12).map((p) => ({
      name: p.fullName,
      detail: [p.affiliations[0]?.title, p.affiliations[0]?.org.name].filter(Boolean).join(' at ') || null,
    })),
  }
}

/** Addresses earlier versions of this edition reached, when that box is ticked; else empty. */
async function reachedByEarlierVersions(ctx: { editionId?: string | null; skipEarlierVersions?: boolean }): Promise<Map<string, Date>> {
  if (!ctx.editionId || !ctx.skipEarlierVersions) return new Map()
  const e = await prisma.mailingEdition.findUnique({ where: { id: ctx.editionId }, select: { versionOfId: true } })
  return e ? earlierVersionSends(ctx.editionId, e.versionOfId) : new Map()
}

/** The "Do not email, ever" switch on a CRM record. */
export async function setPersonDoNotEmail(personId: string, on: boolean) {
  const by = await admin()
  await setDoNotEmail(personId, on, by)
  captureServerEvent(by, on ? 'crm_do_not_email_set' : 'crm_do_not_email_cleared', { personId })
  revalidatePath(`/support/admin/crm/people/${personId}`)
}

/**
 * Applies a group to this edition only (add_send / remove_send) or to lists
 * (add_lists / remove_lists). `expected` is the count the person confirmed;
 * if the group changed size meanwhile, nothing happens.
 */
export async function applyAudience(input: {
  filter: AudienceFilter
  op: AudienceOp
  editionId?: string | null
  listIds?: string[]
  expected: number
  skipEarlierVersions?: boolean
}): Promise<{ ok: boolean; message: string }> {
  const by = await admin()
  const { filter, op } = input
  if (isEmptyAudience(filter)) return { ok: false, message: 'Choose at least one contact type, priority, email history, organization or title first.' }
  const sendOp = op === 'add_send' || op === 'remove_send'
  const reachedBefore = sendOp ? await reachedByEarlierVersions({ editionId: input.editionId, skipEarlierVersions: input.skipEarlierVersions }) : new Map<string, Date>()
  const people = (await audiencePeople(filter))
    .map((p) => ({ personId: p.id, name: p.fullName, email: normalizeListEmail(p.email) }))
    .filter((p) => !p.email || !reachedBefore.has(p.email))
  if (people.length !== input.expected) return { ok: false, message: `The group is now ${people.length} people, not ${input.expected}. Check it and try again.` }
  const label = describeAudience(filter, (r) => PERSON_ROLE_LABELS[r])
  let message = ''

  if (op === 'add_send' || op === 'remove_send') {
    const editionId = input.editionId
    if (!editionId) return { ok: false, message: 'No edition to change.' }
    const edition = await prisma.mailingEdition.findUniqueOrThrow({ where: { id: editionId }, select: { status: true } })
    if (edition.status !== 'DRAFT' && edition.status !== 'SCHEDULED') return { ok: false, message: 'This edition has already gone out.' }
    const existing = await prisma.mailingEditionRecipient.findMany({ where: { editionId }, select: { id: true, email: true, personId: true, excluded: true, status: true } })
    const byEmail = new Map(existing.map((r) => [r.email, r]))
    if (op === 'add_send') {
      const withEmail = people.filter((p): p is typeof p & { email: string } => !!p.email)
      const suppressed = new Set((await prisma.mailingSuppression.findMany({ where: { email: { in: withEmail.map((p) => p.email) } }, select: { email: true } })).map((s) => s.email))
      const fresh = withEmail.filter((p) => !byEmail.has(p.email) && !suppressed.has(p.email))
      const rechecked = withEmail
        .filter((p) => byEmail.get(p.email)?.excluded && byEmail.get(p.email)?.status === 'PENDING' && !suppressed.has(p.email))
        .map((p) => byEmail.get(p.email)!.id)
      await prisma.mailingEditionRecipient.createMany({
        data: fresh.map((p) => ({
          editionId, email: p.email, personId: p.personId, source: 'ADDED_THIS_EDITION' as const,
        })),
        skipDuplicates: true,
      })
      if (rechecked.length) await prisma.mailingEditionRecipient.updateMany({ where: { id: { in: rechecked } }, data: { excluded: false, excludedReason: null } })
      const noEmail = people.length - withEmail.length
      message = `Added ${fresh.length}${rechecked.length ? `, re-checked ${rechecked.length}` : ''} for this send.${reachedBefore.size && input.skipEarlierVersions ? ' Anyone an earlier version already emailed was left out.' : ''}${noEmail ? ` ${noEmail} have no email address.` : ''}${suppressed.size ? ` ${suppressed.size} bounced or complained before and were skipped.` : ''}`
    } else {
      const ids = new Set(people.map((p) => p.personId))
      const emails = new Set(people.map((p) => p.email).filter(Boolean))
      const hit = existing.filter((r) => r.status === 'PENDING' && !r.excluded && ((r.personId && ids.has(r.personId)) || emails.has(r.email))).map((r) => r.id)
      if (hit.length) await prisma.mailingEditionRecipient.updateMany({ where: { id: { in: hit } }, data: { excluded: true, excludedReason: 'unchecked' } })
      message = `Unchecked ${hit.length} for this send. They stay on their lists.`
    }
    revalidatePath(`${BASE}/editions/${editionId}`)
  } else {
    const listIds = input.listIds ?? []
    if (listIds.length === 0) return { ok: false, message: 'Tick at least one list.' }
    if (op === 'add_lists') {
      const r = await addManyToLists({
        people: people.filter((p) => p.email).map((p) => ({ personId: p.personId, email: p.email! })),
        listIds, addedVia: 'ADDED_BY_ADMIN', consentNote: `Added as a group: ${label}`, addedByEmail: by,
      })
      const noEmail = people.filter((p) => !p.email).length
      message = `Added ${r.added}.${r.alreadyOn ? ` ${r.alreadyOn} were already on.` : ''}${r.blocked ? ` ${r.blocked} not added — they unsubscribed, bounced or complained before.` : ''}${noEmail ? ` ${noEmail} have no email address.` : ''}`
    } else {
      const { count } = await prisma.mailingListMember.deleteMany({
        where: {
          listId: { in: listIds }, status: 'ACTIVE',
          OR: [{ personId: { in: people.map((p) => p.personId) } }, { email: { in: people.map((p) => p.email).filter((e): e is string => !!e) } }],
        },
      })
      message = `Took ${count} ${count === 1 ? 'membership' : 'memberships'} off. Anyone who unsubscribed stays recorded as unsubscribed.`
    }
    revalidatePath(`${BASE}/lists`)
    revalidatePath(BASE)
    if (input.editionId) revalidatePath(`${BASE}/editions/${input.editionId}`)
  }
  captureServerEvent(by, 'mailing_group_applied', {
    op, people: people.length, editionId: input.editionId ?? null, lists: input.listIds?.length ?? 0,
    roles: filter.roles.length, priorities: filter.priorities.length, hasOrg: !!filter.orgs.trim(), hasTitle: !!filter.titles.trim(),
  })
  return { ok: true, message }
}

/**
 * "Leave out anyone an earlier version already emailed": ticking it
 * unchecks everyone on this roster another version reached; unticking
 * checks them back in. Returns the new counts.
 */
export async function setSkipEarlierVersions(editionId: string, on: boolean) {
  const by = await admin()
  const ed = await prisma.mailingEdition.findUniqueOrThrow({ where: { id: editionId }, select: { versionOfId: true, status: true } })
  if (ed.status !== 'DRAFT' && ed.status !== 'SCHEDULED') return editionCounts(editionId)
  const reached = [...(await earlierVersionSends(editionId, ed.versionOfId)).keys()]
  if (on) {
    await prisma.mailingEditionRecipient.updateMany({
      where: { editionId, status: 'PENDING', email: { in: reached }, excluded: false },
      data: { excluded: true, excludedReason: 'already_got_version' },
    })
  } else {
    await prisma.mailingEditionRecipient.updateMany({
      where: { editionId, status: 'PENDING', excludedReason: 'already_got_version' },
      data: { excluded: false, excludedReason: null },
    })
  }
  captureServerEvent(by, 'mailing_skip_earlier_versions_toggled', { editionId, on, reached: reached.length })
  revalidatePath(`${BASE}/editions/${editionId}`)
  return editionCounts(editionId)
}
