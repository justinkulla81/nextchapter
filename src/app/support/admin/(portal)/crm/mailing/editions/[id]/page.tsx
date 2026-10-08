import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { activeLists, getMailingSettings } from '@/lib/mailing/lists'
import { fileUrlFor, syncEditionRoster } from '@/lib/mailing/editions'
import { sanitizeBodyHtml } from '@/lib/mailing/render'
import { MailingComposer } from '@/components/admin/mailing/MailingComposer'

export const maxDuration = 60

const when = (d: Date | null) => (d ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

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
  const stats = [
    { label: 'Sent', value: sent, of: sendable.length },
    { label: 'Delivered', value: total((r) => r.deliveredAt) },
    { label: 'Opened (approximate)', value: total((r) => r.openedAt), note: 'Apple Mail opens many emails automatically, so this runs high. Clicks and replies are the real signal.' },
    { label: 'Clicked', value: total((r) => r.clickedAt) },
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
            {s.note && <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{s.note}</p>}
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recipients</h2>
          <Link href={`/support/admin/crm/mailing/editions/${edition.id}/export`} prefetch={false} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Download CSV
          </Link>
        </div>
        <div className="max-h-[40rem] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted text-left">
              <tr>
                {['Name', 'Email', 'Sent', 'Delivered', 'Opened (approx.)', 'Clicked', 'Bounced', 'Unsubscribed', 'Replied'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sendable.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-1.5">
                    {r.personId ? <Link href={`/support/admin/crm/people/${r.personId}`} className="hover:underline">{r.person?.fullName ?? '—'}</Link> : '—'}
                    {r.source === 'ADDED_THIS_EDITION' && <span className="ml-1.5 rounded-full bg-brand/10 px-1.5 py-0.5 text-[11px] text-brand">added</span>}
                  </td>
                  <td className="px-3 py-1.5">{r.email}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{r.status === 'SENT' ? when(r.sentAt) : r.status === 'FAILED' ? <span className="text-destructive" title={r.error ?? ''}>Failed</span> : r.status === 'SKIPPED' ? 'Skipped' : 'Waiting'}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{when(r.deliveredAt)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{r.openedAt ? `${when(r.openedAt)}${r.openCount > 1 ? ` (${r.openCount}×)` : ''}` : ''}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{r.clickedAt ? `${when(r.clickedAt)}${r.clickCount > 1 ? ` (${r.clickCount}×)` : ''}` : ''}</td>
                  <td className="px-3 py-1.5 text-xs" title={r.bounceDetail ?? ''}>{when(r.bouncedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{when(r.unsubscribedAt)}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{when(r.repliedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
