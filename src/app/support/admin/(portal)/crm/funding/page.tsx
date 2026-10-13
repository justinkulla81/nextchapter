import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { listOpenOpportunities } from '@/lib/funding-opportunities/store'
import { label, type ApplicantKind } from '@/lib/funding-opportunities/eligibility'
import { formatDate } from '@/lib/crm/labels'

export const maxDuration = 30

const AUDIENCES = [['CUSTOMERS', 'For customers to win'], ['US', 'For us to bid']] as const
const ELIGIBILITY = [['DIRECT', 'We can apply'], ['VIA_PARTNER', 'Via partner'], ['UNKNOWN', 'Unconfirmed']] as const

/** Open federal grants and solicitations, filterable by who can win and how we can pursue them. */
export default async function CrmFundingPage({ searchParams }: { searchParams: Promise<{ audience?: string; eligibility?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const audience = AUDIENCES.find(([v]) => v === sp.audience)?.[0]
  const eligibility = ELIGIBILITY.find(([v]) => v === sp.eligibility)?.[0]

  let rows: Awaited<ReturnType<typeof listOpenOpportunities>> = []
  let missing = false
  try {
    rows = await listOpenOpportunities({ audience, eligibility })
  } catch {
    missing = true
  }

  const href = (a?: string, e?: string) => {
    const q = new URLSearchParams()
    if (a) q.set('audience', a)
    if (e) q.set('eligibility', e)
    const s = q.toString()
    return `/support/admin/crm/funding${s ? `?${s}` : ''}`
  }
  const chip = (active: boolean) =>
    `rounded-md border px-2.5 py-1 text-xs ${active ? 'border-foreground bg-muted font-medium' : 'border-border hover:bg-muted'}`

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Open funding</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Federal grants (Grants.gov) and solicitations (SAM.gov) in our subject area, refreshed daily. Anything neither we
          nor a customer can pursue is left out.
        </p>
      </header>

      {missing ? (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          The FundingOpportunity table is not applied yet. Run <code>prisma/manual/funding-opportunities.sql</code>, then the next daily run fills this page.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href(undefined, eligibility)} className={chip(!audience)}>All</Link>
            {AUDIENCES.map(([v, l]) => <Link key={v} href={href(v, eligibility)} className={chip(audience === v)}>{l}</Link>)}
            <span className="mx-1 text-muted-foreground">·</span>
            <Link href={href(audience)} className={chip(!eligibility)}>Any eligibility</Link>
            {ELIGIBILITY.map(([v, l]) => <Link key={v} href={href(audience, v)} className={chip(eligibility === v)}>{l}</Link>)}
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing open matches.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {rows.map((o) => (
                <li key={o.id} className="space-y-1 p-3 text-sm">
                  <a href={o.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{o.title}</a>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{o.agency}</span>
                    <span className="rounded border border-border px-1.5 py-0.5">{o.audience === 'CUSTOMERS' ? 'For customers to win' : 'For us to bid'}</span>
                    <span className="rounded border border-border px-1.5 py-0.5">{ELIGIBILITY.find(([v]) => v === o.eligibility)?.[1]}</span>
                    {o.closesAt ? <span>Closes {formatDate(o.closesAt)}</span> : <span>No close date</span>}
                    {o.awardCeiling ? <span>Up to ${Math.round(o.awardCeiling).toLocaleString('en-US')}</span> : null}
                  </div>
                  {o.eligibilityNote && <p className="text-xs text-muted-foreground">{o.eligibilityNote}</p>}
                  {o.partnerKinds.length > 0 && (
                    <p className="text-xs text-muted-foreground">Can apply: {(o.partnerKinds as ApplicantKind[]).map(label).join(', ')}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
