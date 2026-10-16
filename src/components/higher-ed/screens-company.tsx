// "Your company": a workforce org's member company in the org's portal.
// Counts only about its people; groups under five show as "<5".

import Link from 'next/link'
import { Building2 } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { companyOverview, memberCompanyFor } from '@/lib/workforce/company-portal'
import { small } from '@/lib/workforce/hub'
import { EmptyState } from '@/components/ui/empty-state'
import { StatTile } from './StatTile'
import { HiringStatus, SeatRequestForm } from './CompanyForms'

type Props = { ctx: WorkspaceContext }

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '—')

function NotConnected({ ctx }: Props) {
  return <EmptyState icon={Building2} title="Not connected to a company" description={`Ask ${ctx.institution.name} to invite your company to its portal.`} />
}

export async function CompanyOverview({ ctx }: Props) {
  const c = await memberCompanyFor(ctx)
  if (!c) return <NotConnected ctx={ctx} />
  const o = await companyOverview(ctx.institution.id, c.id)
  const slug = ctx.institution.slug
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{c.name}</h2>
        <p className="text-sm text-muted-foreground">A member of {ctx.institution.programBrandName ?? ctx.institution.name}{c.industry ? ` · ${c.industry}` : ''}</p>
      </div>
      <section aria-labelledby="your-people" className="space-y-2">
        <h3 id="your-people" className="text-base font-semibold">
          Your people after a layoff
        </h3>
        {o.signedUp === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one yet. When you have a layoff, <Link href={`/i/${slug}/employer/support`} className="font-medium text-primary hover:underline">ask for seats</Link> and share the sign-up page.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label="Signed up" value={small(o.signedUp)} />
            <StatTile label="Joined NextChapter" value={small(o.joined)} />
            <StatTile label="Applying or interviewing" value={small(o.searching)} />
            <StatTile label="Landed new roles" value={small(o.landed)} note="Of people who share their outcome" />
            <StatTile label={`Stayed in ${o.regionLabel}`} value={o.kept === null ? 'Too early' : `${Math.round(o.kept * 100)}%`} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">Counts only. You never see who joined, how anyone&apos;s search is going, or where any one person landed.</p>
      </section>
      <section className="rounded-lg border border-border bg-card p-4">
        <HiringStatus slug={slug} hiring={c.hiring} readOnly={ctx.readOnly} />
      </section>
    </div>
  )
}

const STATUS: Record<string, string> = { REQUESTED: 'Waiting for an answer', APPROVED: 'Approved', DECLINED: 'Declined' }

export async function CompanySupport({ ctx }: Props) {
  const c = await memberCompanyFor(ctx)
  if (!c) return <NotConnected ctx={ctx} />
  const o = await companyOverview(ctx.institution.id, c.id)
  const slug = ctx.institution.slug
  return (
    <div className="space-y-6">
      {!ctx.readOnly && (
        <section aria-labelledby="ask" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="ask" className="text-base font-semibold">
            Ask for seats for a layoff
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {ctx.institution.name} gives the people you lay off free NextChapter: their job market, a weekly plan, coaching and local employers first. Once it approves,
            you get a sign-up page to share in your exit packet.
          </p>
          <SeatRequestForm slug={slug} />
        </section>
      )}
      {o.layoffs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No layoffs or requests yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {o.layoffs.map((l) => (
            <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 p-3">
              <div className="space-y-0.5">
                <p className="font-medium">{(l.seats ?? 0).toLocaleString()} seats · {l.requestStatus ? STATUS[l.requestStatus] ?? l.requestStatus : 'Given by the organization'}</p>
                <p className="text-muted-foreground">
                  {l.requestedAt ? `Asked ${day(l.requestedAt)}` : `Opened ${day(l.createdAt)}`}
                  {l.isActive || l.requestStatus === 'APPROVED' || !l.requestStatus ? ` · ${l._count.participants.toLocaleString()} signed up` : ''}
                </p>
                {l.requestNote && <p className="text-xs text-muted-foreground">“{l.requestNote}”</p>}
              </div>
              {(!l.requestStatus || l.requestStatus === 'APPROVED') && (
                <Link href={`/i/${slug}/rapid/${l.id}`} target="_blank" className="text-xs font-medium text-primary hover:underline">
                  Sign-up page to share{l.isActive ? '' : ' (closed)'}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
