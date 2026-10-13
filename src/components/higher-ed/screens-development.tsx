// Release 3 screens (HE-10): the ROI dashboard, Signals, the Resilience
// Fund, CRM exchange, and the peer benchmark. Giving data is the college's
// own; anything from the candidate side comes through views.ts.

import Link from 'next/link'
import { Download, HandCoins, Sparkles } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { listOpenTransitions, listSignals } from '@/lib/higher-ed/views'
import { roiReport, type RoiReport } from '@/lib/higher-ed/roi'
import { MIN_GROUP } from '@/lib/higher-ed/roi-math'
import { activeFund, AWARD_TYPES, donorReport } from '@/lib/higher-ed/fund'
import { peerBenchmark, type PeerMetric } from '@/lib/higher-ed/peers'
import { revokeFundAward } from '@/app/i/[slug]/(portal)/development-actions'
import { uploadGiftsFromDevelopment } from '@/app/i/[slug]/(portal)/staff-actions'
import { EmptyState } from '@/components/ui/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { StatTile } from './StatTile'
import { SignalRowActions } from './SignalRowActions'
import { AwardForm, FundSettingsForm } from './FundForms'
import { ConfirmActionButton } from './ConfirmActionButton'
import { CrmUploadForm } from './CrmUploadForm'

type Props = { ctx: WorkspaceContext; base: string }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmt = (d: Date | null | undefined) => (d ? dateFmt.format(new Date(d)) : null)
const usd = (cents: number) => (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(1)}%`)
const name = (m: { firstName: string | null; lastName: string | null }) => [m.firstName, m.lastName].filter(Boolean).join(' ') || 'Unnamed'

// ── ROI dashboard ───────────────────────────────────────────────────────────

function RoiBlock({ r, current }: { r: RoiReport; current: boolean }) {
  const { roi, fy } = r
  const range = `${fmt(fy.start)} – ${fmt(new Date(fy.end.getTime() - 86_400_000))}${current ? ' (so far)' : ''}`
  return (
    <section aria-label={`${fy.label} giving`} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{fy.label}</h2>
        <p className="text-xs text-muted-foreground">{range}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Giving rate lift"
          value={roi.lift === null ? '—' : `${roi.lift > 0 ? '+' : ''}${roi.lift.toFixed(1)} pts`}
          note={roi.enough ? 'Users vs matched alumni who never joined, change from last year' : `Shown once both groups reach ${MIN_GROUP}`}
        />
        <StatTile label="Users' giving rate" value={pct(roi.usersRate?.thisFy)} note={`${roi.usersDonors} of ${roi.users} users · last year ${pct(roi.usersRate?.lastFy)}`} />
        <StatTile
          label="Comparison giving rate"
          value={pct(roi.comparisonRate?.thisFy)}
          note={`${roi.comparisonDonors.toLocaleString()} of ${roi.comparison.toLocaleString()} never joined · last year ${pct(roi.comparisonRate?.lastFy)}`}
        />
        <StatTile label="Given after joining" value={usd(roi.giftCentsAfterClaim)} note="Users' gifts dated after they joined" />
        <StatTile label="New donors" value={roi.newDonors.toLocaleString()} note="First-ever gift came after joining" />
        <StatTile label="Lapsed donors back" value={roi.reactivated.toLocaleString()} note="Skipped last year, gave this year after joining" />
      </div>
    </section>
  )
}

export async function DevelopmentRoi({ ctx, base }: Props) {
  const [now, last, signals] = await Promise.all([
    roiReport(ctx.institution.id),
    roiReport(ctx.institution.id, new Date(), -1),
    prisma.prospectFlag.count({ where: { institutionId: ctx.institution.id, dismissedAt: null, exportedAt: null } }),
  ])
  const gratitude = await prisma.outcomeReport.count({ where: { gratitudeStatus: 'PENDING', member: { institutionId: ctx.institution.id } } })
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Users are alumni who joined and used the tools, coaching or a mentor call that year. They&apos;re compared with alumni who never joined, matched by
        class decade and whether they gave the year before. Group sizes are always shown; lift appears once both groups have {MIN_GROUP}. As of the last
        gift import: {fmt(now.lastImportAt) ?? 'none yet'}.
      </p>
      {(signals > 0 || gratitude > 0) && (
        <Link href={`${base}/signals`} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm hover:border-primary">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          {[signals && `${signals} prospect ${signals === 1 ? 'signal' : 'signals'}`, gratitude && `${gratitude} thank-you ${gratitude === 1 ? 'ask' : 'asks'}`].filter(Boolean).join(' and ')} waiting
        </Link>
      )}
      <RoiBlock r={now} current />
      <RoiBlock r={last} current={false} />
      <section aria-labelledby="fund-total" className="grid gap-3 sm:grid-cols-3">
        <h2 id="fund-total" className="sr-only">
          Resilience Fund
        </h2>
        <StatTile label="Resilience Fund raised" value={usd(now.fund.raisedCents)} href={`${base}/fund`} />
        <StatTile label="Awards made" value={now.fund.awards.toLocaleString()} />
        <StatTile label="Value awarded" value={usd(now.fund.awardedCents)} />
      </section>
      <PeerBenchmarkCard ctx={ctx} />
    </div>
  )
}

// ── Peer benchmark ──────────────────────────────────────────────────────────

const metricValue = (m: PeerMetric, v: number | null) =>
  v === null ? '—' : m.format === 'percent' ? `${Math.round(v * 100)}%` : v.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export async function PeerBenchmarkCard({ ctx }: { ctx: WorkspaceContext }) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { name: true, profile: true } })
  const b = await peerBenchmark(inst)
  if (!b) return null
  return (
    <section aria-labelledby="peers" className="space-y-3">
      <div>
        <h2 id="peers" className="text-base font-semibold">
          How {ctx.institution.name} compares
        </h2>
        <p className="text-sm text-muted-foreground">
          Against {b.peers.length} {b.peerScope}. Federal College Scorecard and IPEDS data{b.college.dataYear ? `, ${b.college.dataYear}` : ''}.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {b.metrics.map((m) => (
          <StatTile key={m.key} label={m.label} value={metricValue(m, m.value)} note={m.rank ? `#${m.rank} of ${m.of} · peer median ${metricValue(m, m.median)}` : `Peer median ${metricValue(m, m.median)}`} />
        ))}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">The peer group</summary>
        <p className="mt-2 text-muted-foreground">{b.peers.map((p) => p.name).join(' · ')}</p>
      </details>
    </section>
  )
}

// ── Signals ─────────────────────────────────────────────────────────────────

const SIGNAL_LABELS: Record<string, { label: string; what: string }> = {
  PROMOTION_VP_PLUS: { label: 'Promoted to VP or above', what: 'A major-gift conversation may be timely.' },
  NEW_EMPLOYER_MATCHING_GIFT: { label: 'New employer', what: 'Check for a matching-gift program.' },
  EXIT: { label: 'Company exit', what: 'A liquidity event.' },
  GRATITUDE: { label: 'Said we helped', what: 'Their quiet period is over. Send a thank-you with your giving link?' },
}

export async function DevelopmentSignals({ ctx }: Props) {
  const rows = await listSignals(ctx)
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { givingUrl: true } })
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Alumni who told {ctx.institution.name} about a new job and share their outcome. Approve a signal to include it in the next CRM updates file; a
        thank-you goes only to alumni who said the college helped, after their quiet period.
        {!inst.givingUrl && ' Add your giving page in Admin › Overview to send thank-yous.'}
      </p>
      {rows.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {rows.map((r) => (
            <li key={`${r.kind}:${r.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">
                  {name(r)}
                  {r.classYear && <span className="text-muted-foreground"> &rsquo;{String(r.classYear).slice(2)}</span>}
                  <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">{SIGNAL_LABELS[r.kind]?.label ?? r.kind}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {[r.title, r.employer].filter(Boolean).join(' at ') || 'Role not shared'} · {fmt(r.detectedAt)} · {SIGNAL_LABELS[r.kind]?.what}
                </p>
              </div>
              {ctx.readOnly ? null : (
                <SignalRowActions
                  slug={ctx.institution.slug}
                  id={r.id}
                  kind={r.kind}
                  approved={!!r.approvedAt}
                  blocked={r.doNotSolicit || (r.kind === 'GRATITUDE' && !inst.givingUrl)}
                  isDemo={ctx.institution.isDemo}
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Sparkles} title="No signals right now" description="Promotions, new employers and thank-you asks show up here as alumni report new jobs." />
      )}
    </div>
  )
}

// ── Resilience Fund ─────────────────────────────────────────────────────────

export async function DevelopmentFund({ ctx }: Props) {
  const id = ctx.institution.id
  const [fund, report, transitions] = await Promise.all([activeFund(id), donorReport(id), listOpenTransitions(ctx)])
  const awards = fund
    ? await prisma.fundAward.findMany({
        where: { fundId: fund.id },
        orderBy: { awardedAt: 'desc' },
        select: { id: true, awardType: true, valueCents: true, status: true, awardedAt: true, member: { select: { firstName: true, lastName: true } } },
      })
    : []
  const canEdit = !ctx.readOnly
  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Donors fund coaching for alumni between jobs. Award it here; the alum sees it as prepaid on their coaching. The donor report shows what the money
        did, in counts only.
      </p>
      {canEdit && (
        <section aria-labelledby="fund-settings" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 id="fund-settings" className="text-base font-semibold">
            The fund
          </h2>
          <FundSettingsForm
            slug={ctx.institution.slug}
            defaults={{
              name: fund?.name ?? '',
              description: fund?.description ?? '',
              goal: fund ? String(fund.goalCents / 100) : '',
              raised: fund ? String(fund.raisedCents / 100) : '',
            }}
          />
        </section>
      )}
      {fund && (
        <>
          <section aria-labelledby="fund-report" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="fund-report" className="text-base font-semibold">
                Donor report
              </h2>
              <Link href={`/i/${ctx.institution.slug}/report/fund`} target="_blank" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                Open printable report
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Raised" value={usd(fund.raisedCents)} note={fund.goalCents ? `of ${usd(fund.goalCents)} goal` : undefined} />
              <StatTile label="Alumni funded" value={report.awards.toLocaleString()} note={usd(report.awardedCents)} />
              <StatTile label="Placed since their award" value={report.placed.toLocaleString()} />
              <StatTile label="Shared their story" value={report.sharedStories.toLocaleString()} />
            </div>
          </section>
          {canEdit && (
            <section aria-labelledby="fund-award" className="space-y-3 rounded-lg border border-border bg-card p-4">
              <h2 id="fund-award" className="text-base font-semibold">
                Make an award
              </h2>
              <AwardForm
                slug={ctx.institution.slug}
                candidates={transitions.filter((t) => t.state === 'IN_TRANSITION').map((t) => ({ id: t.memberId, name: name(t) }))}
                types={AWARD_TYPES}
              />
            </section>
          )}
          <section aria-labelledby="fund-awards" className="space-y-2">
            <h2 id="fund-awards" className="text-base font-semibold">
              Awards
            </h2>
            {awards.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {awards.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                    <span>
                      {name(a.member)} · {AWARD_TYPES.find((t) => t.key === a.awardType)?.label} · {usd(a.valueCents)} · {fmt(a.awardedAt)}
                    </span>
                    {a.status === 'AWARDED' && canEdit ? (
                      <ConfirmActionButton
                        label="Revoke"
                        variant="outline"
                        confirm={`Revoke ${name(a.member)}'s unused award?`}
                        confirmLabel="Revoke award"
                        run={revokeFundAward.bind(null, ctx.institution.slug, a.id)}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">{a.status === 'AWARDED' ? 'Not used yet' : a.status === 'REDEEMED' ? 'Used' : 'Revoked'}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={HandCoins} title="No awards yet" description="Award coaching to an alum in transition and it shows here." />
            )}
          </section>
        </>
      )}
    </div>
  )
}

// ── CRM exchange ────────────────────────────────────────────────────────────

const DIRECTION_LABELS: Record<string, string> = { IMPORT_ROSTER: 'Roster import', IMPORT_GIFTS: 'Gift import', EXPORT_UPDATES: 'Updates export' }

export async function DevelopmentCrm({ ctx }: Props) {
  const runs = await prisma.crmExchangeRun.findMany({
    where: { institutionId: ctx.institution.id },
    orderBy: { startedAt: 'desc' },
    take: 20,
    select: { id: true, direction: true, fileName: true, rowCount: true, errorCount: true, status: true, startedAt: true },
  })
  const slug = ctx.institution.slug
  return (
    <div className="space-y-8">
      <section aria-labelledby="crm-out" className="space-y-3">
        <h2 id="crm-out" className="text-base font-semibold">
          Download for your CRM
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          The updates file has one row per alum with a CRM id: new employer and title (only for alumni who share their outcome), in transition,
          do-not-solicit, approved prospect signals, engagement tier, last active, and email status (unsubscribed, bounced or marked as spam) so your CRM stops mailing those addresses too. The suppression list is everyone you shouldn&apos;t ask right now.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href={`/i/${slug}/export/updates`} download className={cn(buttonVariants(), 'gap-2')}>
            <Download className="size-4" aria-hidden="true" />
            Download updates CSV
          </a>
          <a href={`/i/${slug}/export/suppression`} download className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
            <Download className="size-4" aria-hidden="true" />
            Download do-not-solicit list
          </a>
        </div>
      </section>
      {!ctx.readOnly && (
        <section aria-labelledby="crm-in" className="space-y-3">
          <h2 id="crm-in" className="text-base font-semibold">
            Upload gifts
          </h2>
          <p className="text-sm text-muted-foreground">
            A CSV with external_id, gift_date, amount, fund, appeal. Uploading the same file twice adds nothing. Roster uploads live in Admin › Roster.
          </p>
          <CrmUploadForm id="dev-gifts" title="Gifts" columns="external_id, gift_date, amount, fund, appeal" action={uploadGiftsFromDevelopment.bind(null, slug)} />
        </section>
      )}
      <section aria-labelledby="crm-runs" className="space-y-2">
        <h2 id="crm-runs" className="text-base font-semibold">
          History
        </h2>
        {runs.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card text-sm">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {DIRECTION_LABELS[r.direction]} · {r.fileName ?? '—'}
                </span>
                <span className="text-muted-foreground">
                  {r.rowCount.toLocaleString()} rows{r.errorCount ? `, ${r.errorCount} errors` : ''} · {r.status.toLowerCase()} · {fmt(r.startedAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing yet.</p>
        )}
      </section>
    </div>
  )
}
