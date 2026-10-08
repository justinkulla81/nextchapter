import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { appUrl, editionCounts, syncEditionRoster } from './editions'
import { getMailingSettings } from './lists'
import { prefillEdition } from './prefill'
import { CADENCE_LABEL, periodFor, samePeriod, type Period } from './cadence'
import { escapeHtml } from './render'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * A new draft edition for one or more lists, prefilled and with its roster
 * built from the lists' current members. Used by "New edition" and by the
 * cadence job; neither ever sends — that takes your approval on the page.
 */
export async function createEditionDraft(input: {
  listIds: string[]
  by: string
  /** Set by the cadence job: the period this draft is for. */
  period?: Period & { listId: string }
}): Promise<string> {
  const lists = await prisma.mailingList.findMany({ where: { id: { in: input.listIds } } })
  const primary = lists.find((l) => l.id === input.listIds[0]) ?? lists[0]
  const now = new Date()
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const label = input.period?.label ?? `${MONTHS[now.getMonth()]} ${now.getFullYear()}`
  const isReport = primary.key === 'monthly_update'

  // A key that's free: "monthly-2026-10", then "-2", "-3" for a second one.
  const stem = `${isReport ? 'monthly' : primary.key.replace(/_/g, '-')}-${(input.period?.key ?? ym).toLowerCase()}`
  let key = stem
  for (let i = 2; await prisma.mailingEdition.findUnique({ where: { key } }); i++) key = `${stem}-${i}`

  const prefill = await prefillEdition({ listId: primary.id, listName: primary.name, periodLabel: label })
  const edition = await prisma.mailingEdition.create({
    data: {
      key,
      title: `${label} ${primary.name}`,
      isReport,
      reportKey: isReport ? ym : null,
      subject: prefill.subject,
      previewText: prefill.previewText,
      bodyHtml: prefill.bodyHtml,
      createdByEmail: input.by,
      cadenceListId: input.period?.listId ?? null,
      periodKey: input.period?.key ?? null,
      lists: { create: input.listIds.map((listId) => ({ listId })) },
    },
  })
  await syncEditionRoster(edition.id)
  captureServerEvent(input.by, 'mailing_edition_created', {
    editionId: edition.id, key, lists: lists.map((l) => l.key), copiedFrom: prefill.copiedFromId,
    cadence: input.period ? primary.cadence : null, periodKey: input.period?.key ?? null,
  })
  return edition.id
}

/**
 * The cadence job: for each active list that's due this period and has no
 * edition yet, make the draft and email you to approve it. A draft you
 * started by hand this period counts, so you never get a second one.
 */
export async function draftDueEditions(now = new Date()): Promise<{ drafted: string[]; notified: number }> {
  const lists = await prisma.mailingList.findMany({ where: { isActive: true, cadence: { not: 'AD_HOC' } } })
  const drafted: string[] = []
  for (const list of lists) {
    const period = periodFor(list.cadence, now)
    if (!period) continue
    const recent = await prisma.mailingEdition.findMany({
      where: { lists: { some: { listId: list.id } }, createdAt: { gte: new Date(now.getTime() - 400 * 86_400_000) } },
      select: { createdAt: true, cadenceListId: true, periodKey: true },
    })
    const covered = recent.some((e) =>
      (e.cadenceListId === list.id && e.periodKey === period.key) || samePeriod(list.cadence, e.createdAt, now))
    if (covered) continue
    try {
      drafted.push(await createEditionDraft({ listIds: [list.id], by: 'cadence-job', period: { ...period, listId: list.id } }))
    } catch (e) {
      // The unique (list, period) index makes a concurrent run fail here
      // rather than draft twice.
      console.error(`Cadence draft failed for list ${list.key}`, e)
    }
  }
  const notified = await requestApprovals()
  return { drafted, notified }
}

/** Emails you once for every draft the cadence job made that you haven't been told about. */
export async function requestApprovals(): Promise<number> {
  const pending = await prisma.mailingEdition.findMany({
    where: { status: 'DRAFT', cadenceListId: { not: null }, approvalRequestedAt: null },
    include: { lists: { include: { list: { select: { name: true, cadence: true } } } } },
    orderBy: { createdAt: 'asc' },
  })
  if (pending.length === 0) return 0
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping mailing approval email.')
    return 0
  }
  const settings = await getMailingSettings()
  const rows: string[] = []
  for (const e of pending) {
    const c = await editionCounts(e.id)
    const listNames = e.lists.map((l) => `${l.list.name} (${CADENCE_LABEL[l.list.cadence].toLowerCase()})`).join(', ')
    rows.push(
      `<li style="margin-bottom:12px"><a href="${appUrl()}/support/admin/crm/mailing/editions/${e.id}"><b>${escapeHtml(e.title)}</b></a><br>` +
      `Subject: ${escapeHtml(e.subject || '(none yet)')}<br>To: ${listNames} · ${c.total} ${c.total === 1 ? 'person' : 'people'}</li>`,
    )
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    to: settings.testEmail,
    subject: pending.length === 1 ? `Ready for your approval: ${pending[0].title}` : `${pending.length} mailing list emails ready for your approval`,
    html:
      `<p>${pending.length === 1 ? 'A draft is' : `${pending.length} drafts are`} ready. Nothing goes out until you open it, check the text and who it goes to, and approve the send.</p>` +
      `<ul style="padding-left:18px">${rows.join('')}</ul>` +
      `<p style="color:#666;font-size:13px">Add or remove people for this send only on the same page — the list itself stays as it is.</p>`,
  })
  if (error) {
    console.error('Mailing approval email failed', error)
    return 0
  }
  await prisma.mailingEdition.updateMany({ where: { id: { in: pending.map((e) => e.id) } }, data: { approvalRequestedAt: new Date() } })
  captureServerEvent('cadence-job', 'mailing_approval_requested', { editionIds: pending.map((e) => e.id), count: pending.length })
  return pending.length
}
