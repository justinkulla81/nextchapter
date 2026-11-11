import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { prisma } from '@/lib/prisma'
import { EditionRecipientsTable } from '@/components/admin/mailing/EditionRecipientsTable'

export const maxDuration = 60

const iso = (d: Date | null) => d?.toISOString() ?? null
/** Most people any one mailing reaches; the table is a client-side list, so this keeps the page bounded. */
const MAX_ROWS = 6000

/** Every person in every version of one mailing (the October edition and its versions), in one sortable, filterable table. */
export default async function MailingEveryonePage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  const { id } = await params
  const edition = await prisma.mailingEdition.findUniqueOrThrow({ where: { id }, select: { id: true, title: true, versionOfId: true } })
  const rootId = edition.versionOfId ?? edition.id
  const editions = await prisma.mailingEdition.findMany({
    where: { OR: [{ id: rootId }, { versionOfId: rootId }] },
    orderBy: { createdAt: 'asc' },
    select: { id: true, title: true },
  })
  const recipients = await prisma.mailingEditionRecipient.findMany({
    where: { editionId: { in: editions.map((e) => e.id) }, excluded: false, sentAt: { not: null } },
    orderBy: { sentAt: 'desc' },
    take: MAX_ROWS,
    select: {
      id: true, editionId: true, personId: true, email: true, source: true, status: true, error: true, sentAt: true, deliveredAt: true,
      openedAt: true, openCount: true, clickedAt: true, clickCount: true, bouncedAt: true, bounceDetail: true, unsubscribedAt: true, repliedAt: true,
      person: { select: { fullName: true } },
    },
  })
  const label = new Map(editions.map((e, i) => [e.id, i === 0 ? 'Original' : (/version \d+/i.exec(e.title)?.[0] ?? e.title)]))
  captureServerEvent(admin.email ?? 'admin', 'mailing_everyone_viewed', { editionId: id, rootId, people: recipients.length })

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <Link href={`/support/admin/crm/mailing/editions/${id}`} className="text-sm text-muted-foreground hover:underline">← Back to the edition</Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Everyone in this mailing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {recipients.length.toLocaleString()} emails sent across {editions.length} versions. Sort any column, or show only bounced or unsubscribed people.
          Click a name to open the person in a new tab and fix their email.
        </p>
      </div>
      <EditionRecipientsTable
        editionId={id}
        allVersions
        rows={recipients.map((r) => ({
          id: r.id, personId: r.personId, name: r.person?.fullName ?? null, email: r.email, added: r.source === 'ADDED_THIS_EDITION',
          status: r.status, error: r.error, sentAt: iso(r.sentAt), deliveredAt: iso(r.deliveredAt), openedAt: iso(r.openedAt),
          openCount: r.openCount, clickedAt: iso(r.clickedAt), clickCount: r.clickCount, bouncedAt: iso(r.bouncedAt),
          bounceDetail: r.bounceDetail, unsubscribedAt: iso(r.unsubscribedAt), repliedAt: iso(r.repliedAt), version: label.get(r.editionId) ?? '',
        }))}
      />
    </div>
  )
}
