// Workforce Hub (a workforce organization): the region's partners working as a team, starting with funding. Funding shows every
// application with the partners in on it, their parts and the match each commits; Partners lists every sister organization, nonprofit,
// funder, college and employer by type; Feed is what is happening nationally and in the region. People are never shown here.

import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { ECO_KINDS, ecoKindLabel, ecoStatusLabel, commitmentLabel } from '@/lib/workforce/ecosystem'
import { COMMIT_ROLES, askText, commitRoleLabel, commitStatusLabel, dollars, matchTotals } from '@/lib/workforce/funding-partners'
import { FEED_SECTIONS, loadFeed, type FeedItem } from '@/lib/workforce/feed'
import { institutionEntitlements, trialForLock } from '@/lib/plans/entitlements'
import { LockedFeature } from '@/components/plans/LockedFeature'
import { StatTile } from './StatTile'
import { AddPartnerForm, AskPartner, RemovePartnerButton, StatusButtons } from './WfhubForms'

type Props = { ctx: WorkspaceContext; searchParams: object; base: string }

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : null)
const STATUS_LABEL: Record<string, string> = { CONSIDERING: 'Considering', DRAFTING: 'Drafting', SUBMITTED: 'Submitted', AWARDED: 'Awarded', DECLINED: 'Declined', CLOSED: 'Closed' }
const OPEN = ['CONSIDERING', 'DRAFTING', 'SUBMITTED']

export async function WfFunding({ ctx, base }: Props) {
  const slug = ctx.institution.slug
  const org = ctx.institution.programBrandName ?? ctx.institution.name
  const allowed = institutionEntitlements({ plan: ctx.institution.plan }).fundingPartners
  const [apps, partners] = await Promise.all([
    prisma.fundingApplication.findMany({
      where: { institutionId: ctx.institution.id },
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 40,
      select: { id: true, name: true, funder: true, status: true, amountRequested: true, amountAwarded: true, matchRequired: true, dueDate: true, commitments: { orderBy: { createdAt: 'asc' }, take: 40, select: { id: true, partnerName: true, partnerKind: true, role: true, status: true, amount: true, note: true } } },
    }),
    prisma.ecosystemPartner.findMany({ where: { institutionId: ctx.institution.id, status: { not: 'DECLINED' } }, orderBy: { name: 'asc' }, take: 200, select: { id: true, name: true } }),
  ])
  const open = apps.filter((a) => OPEN.includes(a.status))
  const requested = open.reduce((n, a) => n + (a.amountRequested ?? 0), 0)
  const required = open.reduce((n, a) => n + (a.matchRequired ?? 0), 0)
  const committed = open.reduce((n, a) => n + matchTotals(a.commitments, null).committed, 0)
  const awarded = apps.reduce((n, a) => n + (a.amountAwarded ?? 0), 0)
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Every funding application {org} is pursuing, with the partners in on it, their parts and the match each commits against what the funder requires. Add the applications themselves under Talent Hub › Funding › Applications.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Applications open" value={open.length} />
        <StatTile label="Requested" value={dollars(requested)} />
        <StatTile label="Match committed" value={dollars(committed)} note={required ? `of ${dollars(required)} required` : undefined} />
        <StatTile label="Awarded" value={dollars(awarded)} />
      </div>
      {!allowed && <LockedFeature feature="fundingPartners" slug={slug} plan={ctx.institution.plan} trial={trialForLock(ctx.institution)} />}
      {apps.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No applications yet. Start one under Talent Hub › Funding, then line up your partners here. <a href={base.replace(/\/workforce-hub$/, '/hub/applications')} className="font-medium text-primary hover:underline">Open Applications</a>
        </p>
      ) : (
        <ul className="space-y-4">
          {apps.map((a) => {
            const t = matchTotals(a.commitments, a.matchRequired)
            return (
              <li key={a.id} className="space-y-3 rounded-lg border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{[a.funder, STATUS_LABEL[a.status] ?? a.status, a.dueDate ? `Due ${day(a.dueDate)}` : null, a.amountRequested ? `Requesting ${dollars(a.amountRequested)}` : null].filter(Boolean).join(' · ')}</p>
                  </div>
                  {a.matchRequired ? (
                    <p className="text-sm tabular-nums">
                      Match {dollars(t.committed)} of {dollars(a.matchRequired)}
                      <span className="block text-xs text-muted-foreground">{t.left === 0 ? 'Fully committed' : `${dollars(t.left)} still to find${t.asked ? `, ${dollars(t.asked)} asked` : ''}`}</span>
                    </p>
                  ) : null}
                </div>
                {a.commitments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No partners recorded yet.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {a.commitments.map((c) => (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                        <span className="min-w-0 flex-1 basis-56">
                          <span className="font-medium">{c.partnerName}</span>
                          <span className="block text-xs text-muted-foreground">{[ecoKindLabel(c.partnerKind), commitRoleLabel(c.role), c.amount ? dollars(c.amount) : null, commitStatusLabel(c.status), c.note].filter(Boolean).join(' · ')}</span>
                        </span>
                        {allowed && !ctx.readOnly && (
                          <span className="flex flex-wrap items-center gap-3">
                            {c.status !== 'COMMITTED' && <AskPartner name={c.partnerName} text={askText({ from: org, partner: c.partnerName, application: a.name, funder: a.funder, due: day(a.dueDate), role: c.role, amount: c.amount })} />}
                            <StatusButtons slug={slug} id={c.id} status={c.status} name={c.partnerName} />
                            <RemovePartnerButton slug={slug} id={c.id} name={c.partnerName} />
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {allowed && !ctx.readOnly && (
                  <details>
                    <summary className="cursor-pointer text-sm font-medium text-primary">Add a partner</summary>
                    <div className="pt-3"><AddPartnerForm slug={slug} applicationId={a.id} partners={partners} /></div>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Parts a partner can play: {COMMIT_ROLES.map((r) => r.label.toLowerCase()).join(', ')}. NextChapter sends nothing: you copy the ask or open it as an email.</p>
    </div>
  )
}

export async function WfPartners({ ctx, base }: Props) {
  const partners = await prisma.ecosystemPartner.findMany({
    where: { institutionId: ctx.institution.id },
    orderBy: { name: 'asc' },
    take: 300,
    select: { id: true, name: true, kind: true, status: true, commitments: true, linkedInstitutionId: true },
  })
  const groups = ECO_KINDS.map((k) => ({ ...k, items: partners.filter((p) => p.kind === k.key) })).filter((g) => g.items.length > 0)
  const known = new Set<string>(ECO_KINDS.map((k) => k.key))
  const rest = partners.filter((p) => !known.has(p.kind))
  if (rest.length) groups.push({ key: 'OTHER', label: 'Other', items: rest })
  const connected = partners.filter((p) => p.linkedInstitutionId).length
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Everyone in your region’s team: sister organizations (economic development, the workforce board, job centers, chambers), nonprofits, funders, colleges and employers. Add and invite them under Talent Hub › Partners › Ecosystem, or from Your network.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Partners" value={partners.length} />
        <StatTile label="Confirmed" value={partners.filter((p) => p.status === 'CONFIRMED').length} />
        <StatTile label="With their own portal" value={connected} />
        <StatTile label="Types of partner" value={groups.length} />
      </div>
      {groups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No partners yet. <a href={`${base}/network`} className="font-medium text-primary hover:underline">Open Your network</a> to invite the people you work with.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="space-y-2" aria-labelledby={`g-${g.key}`}>
            <h2 id={`g-${g.key}`} className="text-base font-semibold">{g.label} <span className="text-sm font-normal text-muted-foreground">({g.items.length})</span></h2>
            <ul className="divide-y divide-border rounded-lg border border-border bg-card">
              {g.items.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {[ecoStatusLabel(p.status), p.linkedInstitutionId ? 'Has its own portal' : null, p.commitments.length ? p.commitments.map(commitmentLabel).join(', ') : null].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}

/** The feed list, shared by the Partner Hub (staff) and Your partnership (a partner's own people). */
export function FeedView({ items, intro }: { items: FeedItem[]; intro: string }) {
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">{intro}</p>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">Nothing new right now. Set your region so the feed can follow it.</p>
      ) : (
        FEED_SECTIONS.map((s) => {
          const list = items.filter((i) => i.kind === s.kind)
          if (list.length === 0) return null
          return (
            <section key={s.kind} className="space-y-2" aria-labelledby={`f-${s.kind}`}>
              <h2 id={`f-${s.kind}`} className="text-base font-semibold">{s.title}</h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {list.map((i, n) => (
                  <li key={`${i.title}-${n}`} className="flex flex-wrap items-start justify-between gap-3 p-3 text-sm">
                    <span className="min-w-0 flex-1 basis-64">
                      <span className="font-medium">{i.href ? <a href={i.href} target="_blank" rel="noreferrer" className="hover:underline">{i.title}</a> : i.title}</span>
                      {i.detail && <span className="block text-xs text-muted-foreground">{i.detail}</span>}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5 font-medium">{i.scope === 'national' ? 'National' : 'Your region'}</span>
                      {i.date ?? ''}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })
      )}
    </div>
  )
}

export async function WfFeed({ ctx }: Props) {
  const items = await loadFeed(ctx.institution.id).catch(() => [])
  return <FeedView items={items} intro="What is happening, nationally and in your region: layoffs, funding closing soon, how your city ranks and the latest data. Partners see the same feed under Your partnership." />
}

/** The feed a partner organization's people see (Your partnership): the same feed, read-only. */
export async function PartnerFeed({ ctx }: Props) {
  const items = await loadFeed(ctx.institution.id).catch(() => [])
  const org = ctx.institution.programBrandName ?? ctx.institution.name
  return <FeedView items={items} intro={`What ${org} and its partners are watching: layoffs, funding closing soon, rankings and data, nationally and in the region.`} />
}
