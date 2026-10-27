import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatDate } from '@/lib/crm/labels'

const ORG = '/support/admin/crm/organizations'
const money = (n: number) => (n >= 1_000_000_000 ? `$${(n / 1_000_000_000).toFixed(1)}B` : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n).toLocaleString('en-US')}`)

/**
 * The contracts and RFPs tied to this organization: what it bought and who won it (size, company, dates, the award
 * record, and the re-bid item in the pipeline), what this organization itself has won when it is a competitor, and the
 * RFPs it has posted. Renders nothing when there are none.
 */
export async function CrmCompetitorContracts({ orgId, now = new Date() }: { orgId: string; now?: Date }) {
  const [bought, won, bids, rebids] = await Promise.all([
    prisma.competitorAward.findMany({ where: { buyerOrgId: orgId, confidence: 'EXACT' }, orderBy: { amount: 'desc' }, take: 25 }).catch(() => []),
    prisma.competitorAward.findMany({ where: { competitorOrgId: orgId, confidence: 'EXACT' }, orderBy: { amount: 'desc' }, take: 25 }).catch(() => []),
    prisma.boardBid.findMany({ where: { orgId, status: 'OPEN' }, orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }], take: 10 }).catch(() => []),
    prisma.crmOpportunity.findMany({ where: { orgId, title: { startsWith: 'Possible re-bid' } }, select: { id: true, title: true }, take: 50 }).catch(() => []),
  ])
  if (bought.length === 0 && won.length === 0 && bids.length === 0) return null

  const names = [...new Set([...bought, ...won].map((a) => a.competitorName))]
  const cards = names.length ? await prisma.productCompetitor.findMany({ where: { name: { in: names } }, select: { id: true, name: true } }).catch(() => []) : []
  const cardId = new Map(cards.map((c) => [c.name, c.id]))
  const buyerNames = new Map<string, string>()
  const buyerIds = [...new Set(won.map((a) => a.buyerOrgId).filter((x): x is string => !!x))]
  if (buyerIds.length) for (const o of await prisma.crmOrganization.findMany({ where: { id: { in: buyerIds } }, select: { id: true, name: true } }).catch(() => [])) buyerNames.set(o.id, o.name)
  const rebidFor = (a: { competitorName: string }) => rebids.find((r) => r.title.toLowerCase().includes(a.competitorName.toLowerCase().split(' ')[0]))

  const Row = ({ a, who }: { a: (typeof bought)[number]; who: 'winner' | 'buyer' }) => {
    const running = !!a.endDate && a.endDate.getTime() > now.getTime()
    const rebid = running ? rebidFor(a) : undefined
    const card = cardId.get(a.competitorName)
    return (
      <li className="space-y-0.5 p-3 text-sm">
        <a href={a.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{(a.description ?? a.awardId ?? 'Award').slice(0, 140)}</a>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{money(a.amount)}</span>
          <span>{a.kind === 'GRANT' ? 'Grant' : 'Contract'}</span>
          {who === 'winner' ? (
            <span>
              Won by {a.competitorOrgId ? <Link href={`${ORG}/${a.competitorOrgId}`} className="underline">{a.competitorName}</Link> : a.competitorName}
              {card && <> (<Link href={`/support/admin/vision/competitors?focus=${card}#c-${card}`} className="underline">competitor card</Link>)</>}
            </span>
          ) : (
            <span>Bought by {a.buyerOrgId ? <Link href={`${ORG}/${a.buyerOrgId}`} className="underline">{buyerNames.get(a.buyerOrgId) ?? a.agency ?? 'buyer'}</Link> : (a.agency ?? 'unknown')}</span>
          )}
          <span>{a.startDate ? `Started ${formatDate(a.startDate)}` : 'No start date'}</span>
          <span>{a.endDate ? (running ? `Likely re-bid around ${formatDate(a.endDate)}` : `Ended ${formatDate(a.endDate)}`) : 'No end date'}</span>
          {rebid && <Link href="/support/admin/crm/pipelines/grants" className="underline">Re-bid in the pipeline</Link>}
        </div>
      </li>
    )
  }

  return (
    <section className="space-y-4">
      {bought.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-semibold">Contracts this organization bought from our competitors ({bought.length} · {money(bought.reduce((t, a) => t + a.amount, 0))})</h2>
          <p className="mb-2 text-xs text-muted-foreground">Who won each one, how big it is, and when it likely goes to market again. Source: USAspending.gov.</p>
          <ul className="divide-y divide-border rounded-lg border border-border">{bought.map((a) => <Row key={a.id} a={a} who="winner" />)}</ul>
        </div>
      )}
      {won.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-semibold">Contracts this competitor has won ({won.length} · {money(won.reduce((t, a) => t + a.amount, 0))})</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">{won.map((a) => <Row key={a.id} a={a} who="buyer" />)}</ul>
        </div>
      )}
      {bids.length > 0 && (
        <div>
          <h2 className="mb-1 text-sm font-semibold">Open RFPs this organization posted ({bids.length})</h2>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {bids.map((b) => (
              <li key={b.id} className="space-y-0.5 p-3 text-sm">
                <a href={b.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{b.title.slice(0, 160)}</a>
                <div className="text-xs text-muted-foreground">{b.deadline ? `Due ${formatDate(b.deadline)}` : b.deadlineText ?? 'No deadline listed'}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
