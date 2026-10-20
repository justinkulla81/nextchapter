import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { AlertTriangle, Compass } from 'lucide-react'
import { getDashboardProfile } from '@/lib/dashboard/get-dashboard-data'
import { loadAddressableMarket } from '@/lib/profile/addressable-market'
import { AI_NEED_LABEL } from '@/lib/profile/ai-outlook'
import { stateName } from '@/lib/pivots/scoring'
import { EmptyState } from '@/components/ui/empty-state'
import { ExpansionToggle } from '@/components/dashboard/ExpansionToggle'
import { MarketFlagsCard } from '@/components/dashboard/MarketFlagsCard'
import { isRedesignOn } from '@/lib/redesign/flag'
import { MarketRedesign } from '@/components/market/MarketRedesign'

export const metadata: Metadata = { title: 'Your job market' }

const n = (x: number) => x.toLocaleString()

// The addressable market: how many jobs fit what and where you're searching,
// whether it's narrow, shrinking or exposed to AI, and opt-in ways to make it
// bigger that feed straight into Find My Job and the daily jobs email.
export default async function MarketPage() {
  const profile = await getDashboardProfile()
  const m = await loadAddressableMarket(profile.id)
  const places = m.expansions.filter((e) => e.kind === 'remote' || e.kind === 'state' || e.kind === 'relocate')
  const roles = m.expansions.filter((e) => e.kind === 'role')
  const industries = m.expansions.filter((e) => e.kind === 'industry')
  const redesign = isRedesignOn(profile.email)
  const body = (
    <>
      {!m.role ? (
        <EmptyState icon={Compass} title="Tell us what you do" description="Add your current or target role in Search Strategy and we’ll size your market." cta={{ label: 'Open Search Strategy', href: '/dashboard/search-strategy' }} />
      ) : (
        <section aria-labelledby="size-h" className="space-y-3 rounded-lg border border-border bg-card p-5">
          <h2 id="size-h" className="text-base font-semibold">
            {m.role.label}, at your level
          </h2>
          {m.marketReady ? (
            <dl className="flex flex-wrap gap-8">
              {m.local !== null && (
                <div>
                  <dt className="text-xs text-muted-foreground">Open now in {m.placeLabel}</dt>
                  <dd className="text-2xl font-semibold tabular-nums">{n(m.local)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-muted-foreground">Remote</dt>
                <dd className="text-2xl font-semibold tabular-nums">{n(m.remote)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Nationally</dt>
                <dd className="text-2xl font-semibold tabular-nums">{n(m.national)}</dd>
              </div>
              {m.trendPct !== null && (
                <div>
                  <dt className="text-xs text-muted-foreground">New postings vs before</dt>
                  <dd className={`text-2xl font-semibold tabular-nums ${m.trendPct < 0 ? 'text-warning' : 'text-success'}`}>
                    {m.trendPct > 0 ? '+' : ''}
                    {Math.round(m.trendPct * 100)}%
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">Live job counts are updating. Check back tomorrow.</p>
          )}
          <p className="text-xs text-muted-foreground">From the live NextChapter job board, refreshed nightly. Your level and one below.</p>
        </section>
      )}

      {m.flags.length > 0 && (
        <section aria-labelledby="flags-h" className="space-y-3">
          <h2 id="flags-h" className="text-base font-semibold">
            Worth knowing
          </h2>
          <ul className="space-y-2">
            {m.flags.map((f) => (
              <li key={f.key} className="flex gap-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {m.ai && (
        <section aria-labelledby="ai-h" className="space-y-1">
          <h2 id="ai-h" className="text-base font-semibold">
            Is learning AI critical to staying in your field? {AI_NEED_LABEL[m.ai.aiSkills]}.
          </h2>
          <p className="max-w-2xl text-sm">{m.ai.line}</p>
          <p className="max-w-2xl text-sm text-muted-foreground">What to learn: {m.ai.tools}.</p>
          <p className="text-xs text-muted-foreground">
            Source: {m.ai.source}. AI exposure is the share of tasks AI could do in principle, not measured job loss.{' '}
            <Link className="underline" href="/dashboard/learning">
              Find AI courses
            </Link>
          </p>
        </section>
      )}

      {(places.length > 0 || m.optedIn.states.length > 0) && (
        <section aria-labelledby="places-h" className="space-y-3">
          <h2 id="places-h" className="text-base font-semibold">
            More places
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {places.map((e) => (
              <li key={e.kind + ('state' in e ? e.state : '')} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span>
                  <span className="font-medium">{e.label}</span>
                  <span className="block text-sm text-muted-foreground">{n(e.open)} open roles</span>
                </span>
                <ExpansionToggle kind={e.kind} value={'state' in e ? e.state : e.kind} on={e.kind === 'state' ? m.optedIn.states.includes(e.state) : e.kind === 'remote' ? m.optedIn.remote : false} label={e.label} />
              </li>
            ))}
            {m.optedIn.states
              .filter((s) => !places.some((p) => p.kind === 'state' && p.state === s))
              .map((s) => (
                <li key={s} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <span className="font-medium">Jobs in {stateName(s)}</span>
                  <ExpansionToggle kind="state" value={s} on label={`Jobs in ${stateName(s)}`} />
                </li>
              ))}
          </ul>
        </section>
      )}

      {roles.length > 0 && (
        <section aria-labelledby="roles-h" className="space-y-3">
          <div>
            <h2 id="roles-h" className="text-base font-semibold">
              Bigger markets for your skills
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">Roles that use what you already do. Add one and its jobs show up in Find My Job and your daily email.</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {roles.map((e) =>
              e.kind === 'role' ? (
                <li key={e.role} className="space-y-2 rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{e.label}</p>
                    <span className="text-xs text-muted-foreground">
                      {e.fitLabel}
                      {e.open !== null ? ` · ${n(e.open)} open` : ''}
                    </span>
                  </div>
                  {e.carry.length > 0 && <p className="text-sm"><span className="text-muted-foreground">Carries over: </span>{e.carry.join(', ')}</p>}
                  {e.toAdd.length > 0 && <p className="text-sm"><span className="text-muted-foreground">To add: </span>{e.toAdd.join(', ')}</p>}
                  {e.ai && <p className="text-xs text-muted-foreground">{AI_NEED_LABEL[e.ai.aiSkills]} · {e.ai.group} jobs {e.ai.employmentChangePct > 0 ? '+' : ''}{e.ai.employmentChangePct.toFixed(1)}% since 2022</p>}
                  <ExpansionToggle kind="role" value={e.role} on={m.optedIn.roles.includes(e.role)} label={e.label} />
                </li>
              ) : null,
            )}
          </ul>
          <Link className="text-sm text-primary underline underline-offset-4" href="/dashboard/pivot-paths">
            See every pivot path with its skills
          </Link>
        </section>
      )}

      {(industries.length > 0 || m.optedIn.industries.length > 0) && (
        <section aria-labelledby="ind-h" className="space-y-3">
          <div>
            <h2 id="ind-h" className="text-base font-semibold">
              Other industries hiring {m.role?.label.toLowerCase()}
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">Open roles like yours in industries you haven’t targeted, in the places you’re searching.</p>
          </div>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {industries.map((e) =>
              e.kind === 'industry' ? (
                <li key={e.industry} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <span>
                    <span className="font-medium">{e.label}</span>
                    <span className="block text-sm text-muted-foreground">{n(e.open)} open roles</span>
                  </span>
                  <ExpansionToggle kind="industry" value={e.industry} on={false} label={e.label} />
                </li>
              ) : null,
            )}
            {m.optedIn.industries.map((i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="font-medium">{i}</span>
                <ExpansionToggle kind="industry" value={i} on label={i} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )

  if (redesign) return <MarketRedesign m={m} />

  return (
    <div className="space-y-8">
      <Suspense fallback={null}>
        <MarketFlagsCard candidateId={profile.id} />
      </Suspense>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your job market</h1>
        <p className="max-w-2xl text-muted-foreground">
          How many jobs fit what you’re looking for, where you can work, and how that market is moving. Then ways to make it bigger. Nothing is added to your search
          unless you add it.
        </p>
      </div>
      {body}
    </div>
  )
}
