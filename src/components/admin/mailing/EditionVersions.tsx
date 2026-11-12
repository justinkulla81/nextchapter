import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { humanOpenCount } from '@/lib/mailing/open-human'
import { syncEditionRoster } from '@/lib/mailing/editions'

const STATUS_LABEL = { DRAFT: 'Draft', SCHEDULED: 'Scheduled', SENDING: 'Sending', SENT: 'Sent' } as const

interface Stats { sent: number; delivered: number; opened: number; opens: number; clicked: number; clicks: number; replied: number; bounced: number; unsubscribed: number }

type Row = { status: string; email: string; excluded: boolean; sentAt: Date | null; deliveredAt: Date | null; openedAt: Date | null; openCount: number; clickCount: number; repliedAt: Date | null; bouncedAt: Date | null; unsubscribedAt: Date | null }

function stats(rows: Row[]): Stats {
  const sent = rows.filter((r) => r.status === 'SENT' && !r.excluded)
  return {
    sent: sent.length,
    delivered: sent.filter((r) => r.deliveredAt).length,
    opened: sent.filter((r) => humanOpenCount(r) > 0).length,
    opens: sent.reduce((n, r) => n + humanOpenCount(r), 0),
    clicked: sent.filter((r) => r.clickCount > 0).length,
    clicks: sent.reduce((n, r) => n + r.clickCount, 0),
    replied: sent.filter((r) => r.repliedAt).length,
    bounced: sent.filter((r) => r.bouncedAt).length,
    unsubscribed: sent.filter((r) => r.unsubscribedAt).length,
  }
}

/** Everyone on a version's list: sent, still waiting or failed, but not the people left off it. */
const onList = (rows: Row[]) => new Set(rows.filter((r) => !r.excluded).map((r) => r.email)).size

/** "Nov 12, 8:00 AM ET": the owner reads send times in Eastern. */
const scheduledTime = (d: Date) =>
  `${d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET`

/**
 * Every version of an edition (the original and its copies): each one's
 * sends on its own row, and all of them together. Renders nothing for an
 * edition that has never been copied.
 */
export async function EditionVersions({ editionId, rootId }: { editionId: string; rootId: string }) {
  // A version scheduled or drafted without its roster built (copied or scheduled outside the page) would show 0 people
  // until it sends. Build it now so the table and "See everyone" match what will go out. Reads only the unbuilt ones.
  const unbuilt = await prisma.mailingEdition.findMany({
    where: { OR: [{ id: rootId }, { versionOfId: rootId }], status: { in: ['DRAFT', 'SCHEDULED'] }, recipients: { none: {} } },
    select: { id: true },
  })
  for (const u of unbuilt) await syncEditionRoster(u.id)

  const versions = await prisma.mailingEdition.findMany({
    where: { OR: [{ id: rootId }, { versionOfId: rootId }] },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true, title: true, status: true, sentAt: true, scheduledAt: true,
      recipients: { select: { status: true, email: true, excluded: true, sentAt: true, deliveredAt: true, openedAt: true, openCount: true, clickCount: true, repliedAt: true, bouncedAt: true, unsubscribedAt: true } },
    },
  })
  if (versions.length < 2) return null

  const all = versions.flatMap((v) => v.recipients)
  const together = stats(all)
  const people = new Set(all.filter((r) => r.status === 'SENT' && !r.excluded).map((r) => r.email)).size
  // Distinct people on any version's list: someone on two versions counts once.
  const peopleOnLists = onList(all)
  const cells = (s: Stats) => [
    s.sent, s.delivered, s.opened, s.opens, s.clicked, s.clicks, s.replied, s.bounced, s.unsubscribed,
  ]

  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Versions <span className="text-sm font-normal text-muted-foreground">{versions.length}</span></h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/support/admin/crm/mailing/editions/${editionId}/people`} className="rounded-md bg-navy px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            See everyone in this mailing
          </Link>
          <Link href={`/support/admin/crm/mailing/editions/${editionId}/export?all=1`} prefetch={false} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Download CSV — all versions
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              {['Version', 'Status', 'Scheduled for', 'People in list', 'Sent', 'Delivered', 'Opened', 'Opens', 'Clicked', 'Clicks', 'Replied', 'Bounced', 'Unsubscribed'].map((h) => (
                <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {versions.map((v, i) => (
              <tr key={v.id} className={`border-t border-border ${v.id === editionId ? 'bg-brand/5' : ''}`}>
                <td className="w-[26rem] max-w-[26rem] px-3 py-1.5">
                  <div className="truncate" title={v.title}>
                    {v.id === editionId
                      ? <span className="font-medium">{v.title} <span className="text-xs font-normal text-muted-foreground">(this one)</span></span>
                      : <Link href={`/support/admin/crm/mailing/editions/${v.id}`} className="font-medium text-brand hover:underline">{v.title}</Link>}
                    {i === 0 && <span className="ml-1.5 text-xs text-muted-foreground">original</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-1.5">
                  {STATUS_LABEL[v.status]}{v.sentAt ? ` ${v.sentAt.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}` : ''}
                </td>
                <td className="whitespace-nowrap px-3 py-1.5">{v.status === 'SCHEDULED' && v.scheduledAt ? scheduledTime(v.scheduledAt) : '—'}</td>
                <td className="px-3 py-1.5 tabular-nums">{onList(v.recipients)}</td>
                {cells(stats(v.recipients)).map((c, j) => <td key={j} className="px-3 py-1.5 tabular-nums">{c}</td>)}
              </tr>
            ))}
            <tr className="border-t-2 border-border font-semibold">
              <td className="w-[26rem] max-w-[26rem] px-3 py-1.5">All versions</td>
              <td className="whitespace-nowrap px-3 py-1.5 text-xs font-normal text-muted-foreground">{people} {people === 1 ? 'person' : 'people'}</td>
              <td />
              <td className="px-3 py-1.5 tabular-nums">{peopleOnLists}</td>
              {cells(together).map((c, j) => <td key={j} className="px-3 py-1.5 tabular-nums">{c}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
