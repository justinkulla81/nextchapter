// Entrepreneurship › Founders. Alumni starting or buying a business, for the entrepreneurship center (CMU: Swartz Center) and
// the same list for every office that opens it. Who is on it and what is shared: src/lib/higher-ed/ventures.ts.

import { Rocket } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { readProfile } from '@/lib/higher-ed/profile'
import { EXIT_KINDS, FUNDING_ROUNDS, FUNDING_TOTALS, ventureFlags, ventureFromProfile, type VentureRow } from '@/lib/higher-ed/ventures'
import { markVentureContacted, reportMyVenture, shareVenture } from '@/app/i/[slug]/(portal)/venture-actions'
import { VentureReportForm } from './VentureReportForm'
import { EmptyState } from '@/components/ui/empty-state'
import { ActionButton } from './CommunityForms'

type Props = { ctx: WorkspaceContext; base: string }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const SOURCE: Record<VentureRow['source'], string> = {
  CHECK_IN: 'Said so in a check-in',
  SHARED: 'Shares their venture',
  OUTCOME: 'Shared as a new job',
}
const name = (r: VentureRow) => [r.firstName, r.lastName].filter(Boolean).join(' ') || r.email

export async function VenturesFounders({ ctx }: Props) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { profile: true } })
  const center = readProfile(inst.profile).college?.entrepreneurshipCenter?.name ?? 'The entrepreneurship center'
  const rows = await ventureFlags(ctx.institution.id)
  const canAct = !ctx.readOnly && (ctx.tokens.has('ENTREPRENEURSHIP') || ctx.tokens.has('INSTITUTION_ADMIN'))
  const started = rows.filter((r) => r.status === 'STARTED')
  const considering = rows.filter((r) => r.status === 'CONSIDERING')
  const list = (xs: VentureRow[], id: string, title: string, intro: string) => (
    <section aria-labelledby={id} className="space-y-2">
      <h2 id={id} className="text-base font-semibold">
        {title} <span className="text-sm font-normal text-muted-foreground">{xs.length.toLocaleString()}</span>
      </h2>
      <p className="text-sm text-muted-foreground">{intro}</p>
      {xs.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">No one yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {xs.map((r) => (
            <li key={r.id} className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="space-y-1">
                <p className="font-medium">
                  {name(r)}
                  {r.classYear ? <span className="text-muted-foreground"> ’{String(r.classYear).slice(-2)}</span> : null}
                  {r.ventureName ? <span className="font-normal"> · {r.ventureName}</span> : null}
                </p>
                <p className="text-sm text-muted-foreground">
                  {[r.stage, ...r.details].filter(Boolean).join(' · ') || (r.funding.length ? null : 'No venture details shared')}
                </p>
                {(r.funding.length > 0 || r.website) && (
                  <p className="text-sm">
                    {r.funding.join(' · ')}
                    {r.website && (
                      <>
                        {r.funding.length ? ' · ' : ''}
                        <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Website
                        </a>
                      </>
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {SOURCE[r.source]} · {r.status === 'STARTED' && r.startedAt ? `started ${dateFmt.format(r.startedAt)}` : `since ${dateFmt.format(r.firstFlaggedAt)}`}
                  {r.contactedAt ? ` · contacted ${dateFmt.format(r.contactedAt)}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a href={`mailto:${r.email}`} className="text-sm font-medium text-primary hover:underline">
                  Email {r.firstName ?? 'them'}
                </a>
                {canAct &&
                  (r.contactedAt ? (
                    <ActionButton label="Mark not contacted" variant="ghost" run={markVentureContacted.bind(null, ctx.institution.slug, r.id, false)} />
                  ) : (
                    <ActionButton label="Mark contacted" run={markVentureContacted.bind(null, ctx.institution.slug, r.id, true)} />
                  ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
  return (
    <div className="max-w-4xl space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Alumni starting or buying a business. {center} reaches out; every office sees the same list, so no one asks twice. An alum is here only if
        they told {ctx.institution.name} in a check-in, switched on sharing their venture, or shared a new job as a founder or owner. Funding and exits are what
        the alum reports. Updated nightly, and at once when an alum answers or changes a setting. Runway, hours and personal money are never shown.
      </p>
      {rows.length === 0 ? (
        <EmptyState icon={Rocket} title="No founders yet" description="Alumni appear here when they say they are starting a company in a check-in, or share their venture." />
      ) : (
        <>
          {list(started, 'v-started', 'Started a company', 'Launched, growing, or now owning a business they bought.')}
          {list(considering, 'v-considering', 'Thinking about starting one', 'Building toward a launch, or looking to buy a business.')}
        </>
      )}
    </div>
  )
}

// On the alum's Home: someone building or buying a business who hasn't shared it is asked once, with one button. The journey is
// confidential by default, so nothing reaches the center until they say yes (or tell the college in a check-in).
export async function VentureShareCard({ ctx }: Props) {
  if (!ctx.memberId) return null
  const m = await prisma.institutionMember.findUnique({
    where: { id: ctx.memberId },
    select: {
      candidate: { select: { journey: true, journeyDetails: true } },
      consents: { where: { scope: 'SHARE_VENTURE' }, orderBy: { changedAt: 'desc' }, take: 1, select: { granted: true } },
      institution: { select: { profile: true } },
    },
  })
  if (!m?.candidate || m.consents.length) return null
  const snap = ventureFromProfile(m.candidate.journey, m.candidate.journeyDetails)
  if (!snap) return null
  const center = readProfile(m.institution.profile).college?.entrepreneurshipCenter
  if (!center) return null
  return (
    <section aria-labelledby="venture-share" className="space-y-2 rounded-lg border border-border bg-card p-4">
      <h2 id="venture-share" className="text-base font-semibold">
        {snap.buying ? 'Buying a business?' : 'Building something of your own?'} {center.name} can help
      </h2>
      <p className="text-sm text-muted-foreground">
        Office hours, programs, investors and alumni customers. Share your venture&apos;s name, stage, kind, customers, team and funding with them. Never
        your runway, hours or money. You can switch it off any time under Privacy.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton label={`Share with ${center.name}`} variant="default" done="Shared. They’ll be in touch." run={shareVenture.bind(null, ctx.institution.slug, true)} />
        <ActionButton label="Not now" variant="ghost" done="Okay. You can share it later under Privacy." run={shareVenture.bind(null, ctx.institution.slug, false)} />
      </div>
    </section>
  )
}

// On the alum's Home: their company as they share it (name, website, funding, exit). Open when they already share a venture;
// otherwise one folded line any alum can open ("Started a company? Tell the Swartz Center").
export async function YourVentureCard({ ctx }: Props) {
  if (!ctx.memberId) return null
  const [inst, flag, consent] = await Promise.all([
    prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { profile: true } }),
    prisma.ventureFlag.findFirst({ where: { memberId: ctx.memberId }, select: { ventureName: true, website: true, fundingRound: true, fundingTotal: true, exitKind: true, exitAcquirer: true, exitYear: true } }),
    prisma.institutionConsent.findFirst({ where: { memberId: ctx.memberId, scope: 'SHARE_VENTURE' }, orderBy: { changedAt: 'desc' }, select: { granted: true } }),
  ])
  const center = readProfile(inst.profile).college?.entrepreneurshipCenter
  if (!center) return null
  const shared = consent?.granted === true
  const d = {
    ventureName: (shared && flag?.ventureName) || '',
    website: (shared && flag?.website) || '',
    fundingRound: (shared && flag?.fundingRound) || '',
    fundingTotal: (shared && flag?.fundingTotal) || '',
    exitKind: (shared && flag?.exitKind) || '',
    exitAcquirer: (shared && flag?.exitAcquirer) || '',
    exitYear: shared && flag?.exitYear ? String(flag.exitYear) : '',
  }
  const form = (
    <VentureReportForm action={reportMyVenture.bind(null, ctx.institution.slug)} center={center.name} defaults={d} rounds={FUNDING_ROUNDS} totals={FUNDING_TOTALS} exits={EXIT_KINDS} />
  )
  const intro = (
    <p className="text-sm text-muted-foreground">
      {center.name} supports alumni founders with office hours, programs, investors and fellow alumni as customers. What you share here is seen by {ctx.institution.name}’s
      offices, and you can stop sharing any time under Privacy.
    </p>
  )
  if (shared && flag)
    return (
      <section aria-labelledby="your-venture" className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 id="your-venture" className="text-base font-semibold">
          Your company
        </h2>
        {intro}
        {form}
      </section>
    )
  return (
    <details className="rounded-lg border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold">Started or run a company? Tell {center.name}</summary>
      <div className="mt-3 space-y-3">
        {intro}
        {form}
      </div>
    </details>
  )
}
