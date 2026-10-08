import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { activeLists, getMailingSettings } from '@/lib/mailing/lists'
import { fileUrlFor, syncEditionRoster } from '@/lib/mailing/editions'
import { sanitizeBodyHtml } from '@/lib/mailing/render'
import { MailingComposer } from '@/components/admin/mailing/MailingComposer'
import { EditionRecipientsTable } from '@/components/admin/mailing/EditionRecipientsTable'

export const maxDuration = 60

const iso = (d: Date | null) => d?.toISOString() ?? null

export default async function EditionPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const exists = await prisma.mailingEdition.findUnique({ where: { id }, select: { status: true } })
  if (!exists) notFound()
  // A draft's roster follows the lists; pick up anyone who joined since.
  if (exists.status === 'DRAFT' || exists.status === 'SCHEDULED') await syncEditionRoster(id)

  const [edition, lists, settings] = await Promise.all([
    prisma.mailingEdition.findUniqueOrThrow({
      where: { id },
      include: {
        lists: { include: { list: { select: { id: true, key: true, name: true, audience: true } } } },
        recipients: {
          orderBy: [{ excluded: 'asc' }, { email: 'asc' }],
          include: {
            person: {
              select: {
                fullName: true, firstName: true,
                affiliations: { where: { isPrimary: true }, take: 1, select: { org: { select: { name: true } } } },
              },
            },
          },
        },
      },
    }),
    activeLists(),
    getMailingSettings(),
  ])
  const manual = edition.isReport && edition.reportKey
    ? new Map((await prisma.crmReportSend.findMany({ where: { editionKey: edition.reportKey, method: 'MANUAL' }, select: { personId: true, sentAt: true } })).map((m) => [m.personId, m.sentAt]))
    : new Map<string, Date>()

  const header = (
    <header className="space-y-1">
      <Link href="/support/admin/crm/mailing" className="text-sm text-muted-foreground hover:underline">← Mailing lists</Link>
      <h1 className="text-2xl font-semibold">{edition.title}</h1>
      <p className="text-sm text-muted-foreground">
        {edition.lists.map((l) => l.list.name).join(' + ')}
        {edition.isReport && edition.reportKey ? ` · Report ${edition.reportKey}` : ''} · {edition.key}
      </p>
    </header>
  )

  if (edition.status === 'DRAFT' || edition.status === 'SCHEDULED') {
    // Archived lists the edition already targets still need to show.
    const allLists = [...lists, ...edition.lists.map((l) => l.list).filter((l) => !lists.some((a) => a.id === l.id))]
    return (
      <div className="space-y-6">
        {header}
        {edition.status === 'DRAFT' && (
          <p className="rounded-lg border border-orange/40 bg-orange/5 px-3 py-2 text-sm">
            {edition.cadenceListId ? 'Drafted automatically for this period and waiting for your approval. ' : 'Draft — '}
            Check the text, add or remove people for this send below, then approve. Nothing goes out until you do.
            {/\[\[[^\]]*\]\]/.test(edition.bodyHtml + edition.subject) && <span className="font-medium"> Replace the [[Write: …]] notes first.</span>}
          </p>
        )}
        <MailingComposer
          edition={{
            id: edition.id, key: edition.key, title: edition.title, isReport: edition.isReport, reportKey: edition.reportKey,
            subject: edition.subject, previewText: edition.previewText, bodyHtml: edition.bodyHtml, reportUrl: edition.reportUrl,
            attachFile: edition.attachFile, attachmentName: edition.attachmentName, attachmentBytes: edition.attachmentBytes,
            status: edition.status, scheduledAt: edition.scheduledAt?.toISOString() ?? null, listIds: edition.lists.map((l) => l.listId),
          }}
          lists={allLists.map((l) => ({ id: l.id, key: l.key, name: l.name, audience: l.audience }))}
          recipients={edition.recipients.map((r) => ({
            id: r.id, email: r.email, name: r.person?.fullName ?? null,
            firstName: r.person?.firstName || r.person?.fullName.split(/\s+/)[0] || null,
            orgName: r.person?.affiliations[0]?.org.name ?? null,
            source: r.source, excluded: r.excluded, excludedReason: r.excludedReason, fromListKeys: r.fromListKeys,
            manualSentAt: r.personId && manual.get(r.personId) ? manual.get(r.personId)!.toISOString() : null,
          }))}
          settings={{ fromName: settings.fromName, fromEmail: settings.fromEmail, testEmail: settings.testEmail, footerText: settings.footerText, postalAddress: settings.postalAddress, ratePerHour: settings.ratePerHour }}
          fileUrl={fileUrlFor(edition.key)}
        />
      </div>
    )
  }

  // Sending or sent: the dashboard.
  const sendable = edition.recipients.filter((r) => !r.excluded)
  const total = (pick: (r: (typeof sendable)[number]) => unknown) => sendable.filter((r) => pick(r)).length
  const sent = total((r) => r.status === 'SENT')
  const sum = (pick: (r: (typeof sendable)[number]) => number) => sendable.reduce((n, r) => n + pick(r), 0)
  const opens = sum((r) => r.openCount)
  const clicks = sum((r) => r.clickCount)
  const stats = [
    { label: 'Sent', value: sent, of: sendable.length },
    { label: 'Delivered', value: total((r) => r.deliveredAt) },
    { label: 'Opened (approximate)', value: total((r) => r.openedAt), extra: `${opens} ${opens === 1 ? 'open' : 'opens'} in all`, note: 'Apple Mail opens many emails automatically, so this runs high. Clicks and replies are the real signal.' },
    { label: 'Clicked', value: total((r) => r.clickedAt), extra: `${clicks} ${clicks === 1 ? 'click' : 'clicks'} in all` },
    { label: 'Replied', value: total((r) => r.repliedAt) },
    { label: 'Bounced', value: total((r) => r.bouncedAt) },
    { label: 'Unsubscribed', value: total((r) => r.unsubscribedAt) },
    { label: 'Failed', value: total((r) => r.status === 'FAILED') },
  ]

  return (
    <div className="space-y-6">
      {header}
      <p className="text-sm">
        {edition.status === 'SENDING'
          ? `Sending — ${sent} of ${sendable.length} so far, up to ${settings.ratePerHour} an hour.`
          : `Sent ${edition.sentAt?.toLocaleDateString('en-US', { dateStyle: 'medium' })} to ${sent} ${sent === 1 ? 'person' : 'people'}.`}
      </p>
      <section className="grid gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-3" title={s.note}>
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {s.value}
              {s.of !== undefined && <span className="text-sm font-normal text-muted-foreground"> / {s.of}</span>}
              {s.of === undefined && sent > 0 && <span className="ml-1 text-sm font-normal text-muted-foreground">{Math.round((s.value / sent) * 100)}%</span>}
            </p>
            {s.extra && <p className="text-xs text-muted-foreground">{s.extra}</p>}
            {s.note && <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{s.note}</p>}
          </div>
        ))}
      </section>

      <EditionRecipientsTable
        editionId={edition.id}
        rows={sendable.map((r) => ({
          id: r.id, personId: r.personId, name: r.person?.fullName ?? null, email: r.email, added: r.source === 'ADDED_THIS_EDITION',
          status: r.status, error: r.error, sentAt: iso(r.sentAt), deliveredAt: iso(r.deliveredAt), openedAt: iso(r.openedAt),
          openCount: r.openCount, clickedAt: iso(r.clickedAt), clickCount: r.clickCount, bouncedAt: iso(r.bouncedAt),
          bounceDetail: r.bounceDetail, unsubscribedAt: iso(r.unsubscribedAt), repliedAt: iso(r.repliedAt),
        }))}
      />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">What was sent</h2>
        <div className="max-w-2xl rounded-lg border border-border bg-white p-4 text-black">
          <p className="mb-3 border-b border-neutral-200 pb-2 text-sm"><span className="text-neutral-500">Subject:</span> {edition.subject}</p>
          <div className="text-[15px] leading-relaxed [&_a]:underline [&_ul]:list-disc [&_ul]:pl-6 [&_p]:mb-3" dangerouslySetInnerHTML={{ __html: sanitizeBodyHtml(edition.bodyHtml) }} />
        </div>
      </section>
    </div>
  )
}
