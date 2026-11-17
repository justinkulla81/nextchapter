// Talent Hub flows (phase 2): the steps of a layoff response, funding applications, and the outcomes report that ties results
// to the response and the funding behind them. Counts under five show as "<5". Reads are bounded and fail soft if the tables
// are not there yet.

import Link from 'next/link'
import { Check, Circle } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { RESPONSE_STEPS } from '@/lib/workforce/program-content'
import { FUNDING_STATUSES, cell, fundingOutcomes, fundingStatusLabel, matchPercent, money, responseOutcomes } from '@/lib/workforce/hub-flow'
import { StatTile } from './StatTile'
import { PrintButton } from './PrintButton'
import { FundingForm, LinkFunding, StepToggle } from './HubFlowForms'

type Props = { ctx: WorkspaceContext; searchParams: object; base: string }

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(d)) : '—')
const dateInput = (d: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : '')

export type FundingOption = { id: string; name: string }

/** Steps done per response, and the institution's funding applications, in two bounded reads. Empty when the tables are missing. */
export async function loadFlowData(institutionId: string, responseIds: string[]) {
  try {
    const [steps, funding] = await Promise.all([
      responseIds.length ? prisma.rapidResponseStep.findMany({ where: { rapidResponseId: { in: responseIds } }, select: { rapidResponseId: true, key: true } }) : Promise.resolve([]),
      prisma.fundingApplication.findMany({ where: { institutionId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, name: true } }),
    ])
    const done = new Map<string, Set<string>>()
    for (const s of steps) done.set(s.rapidResponseId, (done.get(s.rapidResponseId) ?? new Set()).add(s.key))
    return { done, funding: funding as FundingOption[] }
  } catch {
    return { done: new Map<string, Set<string>>(), funding: [] as FundingOption[] }
  }
}

/** The six steps of one layoff response, with a way to mark each done and to say which funding pays for it. */
export function ResponseFlow({ ctx, responseId, done, funding, fundingId }: { ctx: WorkspaceContext; responseId: string; done: Set<string>; funding: FundingOption[]; fundingId: string | null }) {
  const slug = ctx.institution.slug
  const count = RESPONSE_STEPS.filter((s) => done.has(s.key)).length
  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">
        Response steps: {count} of {RESPONSE_STEPS.length} done
      </p>
      <ol className="grid gap-2 md:grid-cols-2">
        {RESPONSE_STEPS.map((s, i) => {
          const isDone = done.has(s.key)
          return (
            <li key={s.key} className="flex items-start justify-between gap-3 rounded-md border border-border p-2.5">
              <div className="flex items-start gap-2">
                {isDone ? <Check className="mt-0.5 size-4 text-primary" aria-label="Done" /> : <Circle className="mt-0.5 size-4 text-muted-foreground" aria-label="Not done yet" />}
                <div>
                  <p className="text-sm font-medium">
                    {i + 1}. {s.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.detail}</p>
                </div>
              </div>
              {!ctx.readOnly && <StepToggle slug={slug} responseId={responseId} stepKey={s.key} done={isDone} />}
            </li>
          )
        })}
      </ol>
      {ctx.readOnly ? (
        <p className="text-xs text-muted-foreground">Paid for by: {funding.find((f) => f.id === fundingId)?.name ?? 'not linked to funding'}</p>
      ) : (
        <LinkFunding slug={slug} responseId={responseId} current={fundingId} options={funding} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

export async function HubApplications({ ctx, base }: Props) {
  const id = ctx.institution.id
  let rows: Awaited<ReturnType<typeof prisma.fundingApplication.findMany>> = []
  try {
    rows = await prisma.fundingApplication.findMany({ where: { institutionId: id }, orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }], take: 100 })
  } catch {
    rows = []
  }
  const count = (k: string) => rows.filter((r) => r.status === k).length
  const awarded = rows.reduce((n, r) => n + (r.status === 'AWARDED' ? (r.amountAwarded ?? 0) : 0), 0)
  const pursuing = rows.filter((r) => ['CONSIDERING', 'DRAFTING', 'SUBMITTED'].includes(r.status)).reduce((n, r) => n + (r.amountRequested ?? 0), 0)
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Being pursued" value={count('CONSIDERING') + count('DRAFTING') + count('SUBMITTED')} note={`${money(pursuing)} requested`} />
        <StatTile label="Submitted" value={count('SUBMITTED')} />
        <StatTile label="Awarded" value={count('AWARDED')} note={`${money(awarded)} awarded`} />
        <StatTile label="Declined or closed" value={count('DECLINED') + count('CLOSED')} />
      </div>

      {!ctx.readOnly && (
        <details className="rounded-lg border border-border bg-card p-4" open={rows.length === 0}>
          <summary className="cursor-pointer text-sm font-medium text-[color:var(--accent-text,var(--primary))]">Add an application</summary>
          <div className="pt-3">
            <FundingForm slug={ctx.institution.slug} />
          </div>
        </details>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          No applications yet. Add the grants you are considering, then follow each from drafting to award, with its match and partners.
        </p>
      ) : (
        FUNDING_STATUSES.map((st) => {
          const list = rows.filter((r) => r.status === st.key)
          if (list.length === 0) return null
          return (
            <section key={st.key} className="space-y-3" aria-label={st.label}>
              <h2 className="text-base font-semibold">{st.label}</h2>
              <ul className="space-y-3">
                {list.map((r) => {
                  const mp = matchPercent(r.matchRequired, r.matchCommitted)
                  return (
                    <li key={r.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="font-medium">{r.name}</p>
                        <p className="text-xs text-muted-foreground">{[r.funder, r.dueDate ? `due ${day(r.dueDate)}` : null].filter(Boolean).join(' · ')}</p>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        Requested {money(r.amountRequested)} · awarded {money(r.amountAwarded)}
                        {r.partners.length > 0 ? ` · partners: ${r.partners.join(', ')}` : ''}
                      </p>
                      {mp !== null && (
                        <div className="mt-2" role="img" aria-label={`Match ${mp}% committed`}>
                          <div className="h-2 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-primary" style={{ width: `${mp}%` }} />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Match: {money(r.matchCommitted)} of {money(r.matchRequired)} committed ({mp}%)
                          </p>
                        </div>
                      )}
                      {r.notes && <p className="mt-2 text-xs text-muted-foreground">{r.notes}</p>}
                      {!ctx.readOnly && (
                        <details className="mt-3">
                          <summary className="cursor-pointer text-xs font-medium text-[color:var(--accent-text,var(--primary))]">Edit</summary>
                          <div className="pt-3">
                            <FundingForm
                              slug={ctx.institution.slug}
                              initial={{ id: r.id, name: r.name, funder: r.funder, status: r.status, amountRequested: r.amountRequested, amountAwarded: r.amountAwarded, matchRequired: r.matchRequired, matchCommitted: r.matchCommitted, dueDate: dateInput(r.dueDate), partners: r.partners.join(', '), notes: r.notes }}
                            />
                          </div>
                        </details>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })
      )}
      <p className="text-xs text-muted-foreground">
        Opportunities to consider are listed under{' '}
        <Link href={`${base}/funding`} className="text-[color:var(--accent-text,var(--primary))] hover:underline">
          Grants and funding
        </Link>
        . A layoff response can be linked to the application that pays for it, and the outcomes report then shows results by funder.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------

export async function HubReport({ ctx }: Props) {
  const id = ctx.institution.id
  const [responses, people, funding] = await Promise.all([
    prisma.rapidResponse.findMany({
      where: { institutionId: id, memberCompanyId: { not: null }, OR: [{ requestStatus: null }, { requestStatus: 'APPROVED' }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, employerName: true, seats: true, fundingApplicationId: true, memberCompany: { select: { name: true } } },
    }),
    // One narrow row per person who signed up through a response; bounded.
    prisma.institutionMember.findMany({
      where: { institutionId: id, rapidResponseId: { not: null } },
      take: 5000,
      select: { rapidResponseId: true, candidateId: true, candidate: { select: { journeyStage: true } }, consents: { where: { scope: 'SHARE_OUTCOME' }, orderBy: { changedAt: 'desc' }, take: 1, select: { granted: true } } },
    }),
    prisma.fundingApplication
      .findMany({ where: { institutionId: id }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, name: true, funder: true, status: true, amountAwarded: true, matchRequired: true, matchCommitted: true } })
      .catch(() => []),
  ])
  const { done } = await loadFlowData(id, responses.map((r) => r.id))
  const outcomes = responseOutcomes(
    responses.map((r) => ({ id: r.id, employer: r.memberCompany?.name ?? r.employerName, seats: r.seats, fundingApplicationId: r.fundingApplicationId, stepsDone: done.get(r.id)?.size ?? 0 })),
    people.map((p) => ({ rapidResponseId: p.rapidResponseId, joined: !!p.candidateId, landed: !!p.candidateId && p.candidate?.journeyStage === 'LANDED' && p.consents[0]?.granted === true })),
  )
  const byFunding = fundingOutcomes(funding, outcomes)
  const total = outcomes.reduce((a, o) => ({ seats: a.seats + o.seats, signedUp: a.signedUp + o.signedUp, joined: a.joined + o.joined, landed: a.landed + o.landed }), { seats: 0, signedUp: 0, joined: 0, landed: 0 })
  const asOf = day(new Date())
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Outcomes report: layoff response and funding</h2>
          <p className="text-sm text-muted-foreground">
            {ctx.institution.name} · as of {asOf}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Seats offered" value={cell(total.seats)} />
        <StatTile label="Signed up" value={cell(total.signedUp)} note={total.seats ? `${Math.round((total.signedUp / total.seats) * 100)}% of seats` : undefined} />
        <StatTile label="Joined NextChapter" value={cell(total.joined)} />
        <StatTile label="Landed new roles" value={cell(total.landed)} note="Only people who share their outcome" />
      </div>

      <section className="space-y-3" aria-labelledby="by-resp">
        <h3 id="by-resp" className="text-base font-semibold">
          By layoff response
        </h3>
        {outcomes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No layoff responses yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Employer', 'Seats', 'Signed up', 'Joined', 'Landed', 'Steps done', 'Paid for by'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outcomes.map((o) => (
                  <tr key={o.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{o.employer}</td>
                    <td className="px-3 py-2 tabular-nums">{cell(o.seats)}</td>
                    <td className="px-3 py-2 tabular-nums">{cell(o.signedUp)}</td>
                    <td className="px-3 py-2 tabular-nums">{cell(o.joined)}</td>
                    <td className="px-3 py-2 tabular-nums">{cell(o.landed)}</td>
                    <td className="px-3 py-2 tabular-nums">{o.stepsDone} of {RESPONSE_STEPS.length}</td>
                    <td className="px-3 py-2 text-muted-foreground">{funding.find((f) => f.id === o.fundingApplicationId)?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="by-fund">
        <h3 id="by-fund" className="text-base font-semibold">
          By funding
        </h3>
        {byFunding.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No funding applications yet. Add them under Funding, then link each layoff response to the one that pays for it.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {['Funding', 'Status', 'Awarded', 'Match', 'Responses', 'Signed up', 'Landed'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byFunding.map((f) => {
                  const mp = matchPercent(f.matchRequired, f.matchCommitted)
                  return (
                    <tr key={f.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        <span className="font-medium">{f.name}</span>
                        {f.funder && <span className="block text-xs text-muted-foreground">{f.funder}</span>}
                      </td>
                      <td className="px-3 py-2">{fundingStatusLabel(f.status)}</td>
                      <td className="px-3 py-2 tabular-nums">{money(f.amountAwarded)}</td>
                      <td className="px-3 py-2 tabular-nums">{mp === null ? '—' : `${mp}% committed`}</td>
                      <td className="px-3 py-2 tabular-nums">{f.responses}</td>
                      <td className="px-3 py-2 tabular-nums">{cell(f.signedUp)}</td>
                      <td className="px-3 py-2 tabular-nums">{cell(f.landed)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="max-w-3xl text-xs text-muted-foreground">
        Counts under five show as &lt;5. “Landed” counts only people who chose to share their outcome, so it is a floor. Amounts are what was requested or awarded, not what was spent. People are never named in this report.
      </p>
    </div>
  )
}
