import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { AUDIENCE_LABEL, CAMPAIGN, type OutreachAudience } from '@/lib/warn/outreach/plan'
import { addCounts, emptyCounts, headlineOf, pct, rollup, type Counts } from '@/lib/warn/outreach/stats'

export const dynamic = 'force-dynamic'

const DAYS = 120
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000)
const label = (a: string | null) => (a && a in AUDIENCE_LABEL ? AUDIENCE_LABEL[a as OutreachAudience] : a ?? 'Other')

/** Admin → CRM → Mailing lists → Layoff outreach campaigns: the emails sent about each layoff, by layoff and by who they went to. */
export default async function LayoffOutreachCampaignsPage() {
  await requireAdmin()
  const since = daysAgo(DAYS)
  const editions = await prisma.mailingEdition.findMany({
    where: { campaign: CAMPAIGN, createdAt: { gte: since } },
    select: { id: true, audience: true, warnNoticeId: true, createdAt: true, title: true },
    orderBy: { createdAt: 'desc' },
    take: 600,
  })
  const ids = editions.map((e) => e.id)
  // One grouped read of the campaign's recipient rows (a few hundred at most), counted by edition. Opens and clicks are the
  // people's own: the tracking already leaves out mail scanners.
  const grouped = ids.length
    ? await prisma.mailingEditionRecipient.groupBy({
        by: ['editionId'],
        where: { editionId: { in: ids }, excluded: false },
        _count: { _all: true, sentAt: true, deliveredAt: true, openedAt: true, clickedAt: true, repliedAt: true, unsubscribedAt: true, bouncedAt: true },
      })
    : []
  const byEdition = new Map<string, Counts>(grouped.map((g) => [g.editionId, {
    recipients: g._count._all, sent: g._count.sentAt, delivered: g._count.deliveredAt, opened: g._count.openedAt, clicked: g._count.clickedAt,
    replied: g._count.repliedAt, unsubscribed: g._count.unsubscribedAt, bounced: g._count.bouncedAt,
  }]))

  const byType = rollup(editions, byEdition, (e) => e.audience)
  const byLayoffType = rollup(editions, byEdition, (e) => (e.warnNoticeId && e.audience ? `${e.warnNoticeId}|${e.audience}` : null))
  const total = [...byType.values()].reduce(addCounts, emptyCounts())
  const titleOf = new Map(editions.map((e) => [e.id, e.title]))
  const byHeadline = rollup(editions, byEdition, (e) => { const h = headlineOf(titleOf.get(e.id)); return h ? `day ${h.day} · ${h.code}` : null })

  const noticeIds = [...new Set(editions.map((e) => e.warnNoticeId).filter((x): x is string => !!x))]
  const notices = noticeIds.length
    ? await prisma.warnNotice.findMany({ where: { id: { in: noticeIds } }, select: { id: true, employer: true, employees: true, state: true } })
    : []
  const noticeById = new Map(notices.map((n) => [n.id, n]))
  const firstSeen = new Map<string, Date>()
  for (const e of editions) if (e.warnNoticeId && (!firstSeen.has(e.warnNoticeId) || e.createdAt < firstSeen.get(e.warnNoticeId)!)) firstSeen.set(e.warnNoticeId, e.createdAt)
  const rows = [...byLayoffType.entries()]
    .map(([k, c]) => { const [noticeId, audience] = k.split('|'); return { noticeId, audience, c, at: firstSeen.get(noticeId)! } })
    .sort((a, b) => b.at.getTime() - a.at.getTime())

  return (
    <div className="space-y-8">
      <header>
        <Link href="/support/admin/crm/mailing" className="text-sm text-muted-foreground hover:underline">← Mailing lists</Link>
        <h1 className="text-2xl font-semibold">Layoff outreach campaigns</h1>
        <p className="mt-1 text-sm"><Link href="/support/admin/crm/mailing/campaigns/backfill" className="text-brand underline underline-offset-4">Backfill: draft the emails for layoffs the sweep missed</Link></p>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          When a layoff alert goes out, the same contacts are emailed (last {DAYS} days shown). Opens and clicks are people&apos;s, not mail scanners&apos;.
          You are on BCC; open links from the copy only in a private window, because they carry the recipient&apos;s tracking id.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">By type</h2>
        <Table head={['Type', ...HEAD]} rows={[
          ...[...byType.entries()].sort((a, b) => b[1].sent - a[1].sent).map(([k, c]) => [label(k), ...cells(c)]),
          ['All types', ...cells(total)],
        ]} emptyText="Nothing sent yet. The first layoff alert after this deploys starts it." />
      </section>

      {byHeadline.size > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Headline test</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Each day two headline styles run against each other, split evenly by audience: n1 number first, q1 a question, loc where they can land, pg the free page, aud the audience&apos;s own line, quick a short personal line, plain the bare fact, num2 number and employer.
            Compare the two styles within a day. Opens are noisy (mail apps preload them) and each arm is small, so read replies and clicks first.
          </p>
          <Table head={['Day · style', ...HEAD]} rows={[...byHeadline.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, c]) => [k, ...cells(c)])} emptyText="" />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">By layoff</h2>
        <Table head={['Layoff', 'Type', ...HEAD]} rows={rows.map((r) => {
          const n = noticeById.get(r.noticeId)
          const name = n ? `${n.employer}${n.employees ? ` (${n.employees.toLocaleString('en-US')})` : ''}${n.state ? `, ${n.state}` : ''}` : r.noticeId
          return [
            <Link key="l" href={`/support/admin/crm/warn/${r.noticeId}`} className="font-medium text-brand hover:underline">{name}</Link>,
            label(r.audience), ...cells(r.c),
          ]
        })} emptyText="No layoff has been emailed yet." />
      </section>
    </div>
  )
}

const HEAD = ['People', 'Sent', 'Opened', 'Clicked', 'Replied', 'Unsubscribed', 'Bounced']
const cells = (c: Counts): string[] => [
  String(c.recipients), String(c.sent), `${c.opened} (${pct(c.opened, c.sent)})`, `${c.clicked} (${pct(c.clicked, c.sent)})`,
  String(c.replied), String(c.unsubscribed), String(c.bounced),
]

function Table({ head, rows, emptyText }: { head: string[]; rows: React.ReactNode[][]; emptyText: string }) {
  if (rows.length === 0) return <p className="rounded-lg border border-border px-3 py-4 text-sm text-muted-foreground">{emptyText}</p>
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className="px-3 py-2">{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}
