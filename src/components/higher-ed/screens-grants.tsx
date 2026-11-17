// Development › Grants and RFPs: funding the college can apply for, matched to
// retraining, entrepreneurship and research, from four sources:
// federal (live from Grants.gov, cached 12 hours), state and foundation (a
// directory checked by hand, for the college's states), and grants the team
// added itself. The team keeps a shortlist and hides what doesn't fit.

import Link from 'next/link'
import { HandCoins } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { customGrants, federalGrants, grantSettingsFrom, GRANT_PURPOSES, SOURCE_LABELS, type Grant, type GrantPurpose, type GrantSource } from '@/lib/higher-ed/grants'
import { directoryGrants } from '@/lib/higher-ed/grant-directory'
import { readProfile, regionAreas } from '@/lib/higher-ed/profile'
import { markGrant, removeCustomGrant } from '@/app/i/[slug]/(portal)/development-actions'
import { EmptyState } from '@/components/ui/empty-state'
import { ActionButton } from './CommunityForms'
import { AddGrantForm, GrantStatesForm } from './GrantForms'
import { cn } from '@/lib/utils'
import { institutionEntitlements, trialForLock } from '@/lib/plans/entitlements'
import { orgKindOf } from '@/lib/higher-ed/workspaces'
import { LockedFeature } from '@/components/plans/LockedFeature'

type Props = { ctx: WorkspaceContext; base: string; searchParams?: { purpose?: string } }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmt = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : null)
const DAY = 86_400_000
const HOW: Record<string, string> = { 'open call': 'Open call', rolling: 'Rolling applications', invitation: 'By invitation or inquiry' }

function GrantRow({ g, slug, saved, canWrite, soonBefore }: { g: Grant; slug: string; saved: boolean; canWrite: boolean; soonBefore: string }) {
  const closes = fmt(g.closeDate)
  const soon = !!g.closeDate && g.closeDate < soonBefore
  const labels = g.purposes.map((p) => GRANT_PURPOSES.find((x) => x.key === p)?.label ?? p).join(', ')
  const when =
    g.status === 'forecasted'
      ? 'Forecast: not open yet'
      : closes
        ? `Closes ${closes}${soon ? ', within 30 days' : ''}`
        : g.how
          ? HOW[g.how]
          : g.source === 'federal'
            ? 'Open, no closing date given'
            : 'No deadline given'
  return (
    <li className="space-y-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <a href={g.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
          {g.title}
        </a>
        {canWrite && (
          <span className="flex flex-wrap gap-2">
            <ActionButton label={saved ? 'Remove from shortlist' : 'Add to shortlist'} variant={saved ? 'ghost' : 'outline'} run={markGrant.bind(null, slug, g.id, saved ? 'unsave' : 'save', g.purposes)} />
            {!saved && g.source !== 'yours' && <ActionButton label="Hide" variant="ghost" done="Hidden." run={markGrant.bind(null, slug, g.id, 'dismiss', g.purposes)} />}
            {g.source === 'yours' && <ActionButton label="Remove" variant="ghost" done="Removed." run={removeCustomGrant.bind(null, slug, g.id)} />}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {SOURCE_LABELS[g.source]} · {g.agency}
        {g.number ? ` · ${g.number}` : ''} · For {labels || 'any purpose'}
        {g.amount ? ` · ${g.amount}` : ''}
      </p>
      {g.note && <p className="text-sm">{g.note}</p>}
      <p className={cn('text-xs', soon ? 'font-medium text-foreground' : 'text-muted-foreground')}>
        {when}
        {g.source !== 'federal' && g.checked ? ` · ${g.source === 'yours' ? 'Added' : 'Checked'} ${fmt(g.checked)}` : ''}
      </p>
    </li>
  )
}

export async function DevelopmentGrants({ ctx, searchParams }: Props) {
  const slug = ctx.institution.slug
  // The shortlist and settings save through Development's actions, so they show only to someone who can open it.
  const canWrite = !ctx.readOnly && ctx.workspaces.includes('development') && (ctx.tokens.has('DEVELOPMENT') || ctx.tokens.has('INSTITUTION_ADMIN'))
  const isCollege = orgKindOf(ctx.institution.orgType) === 'college'
  const freeShown = institutionEntitlements({ plan: ctx.institution.plan }).visibleGrants
  const purpose = GRANT_PURPOSES.find((p) => p.key === searchParams?.purpose)?.key as GrantPurpose | undefined
  const row = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true, profile: true } })
  const settings = grantSettingsFrom(row.enabledFeatures)
  const profile = readProfile(row.profile)
  const ownStates = [...new Set([profile.college?.state, ...regionAreas(profile.region).map((a) => a.state)].filter((s): s is string => !!s).map((s) => s.toUpperCase()))]
  const states = [...new Set([...ownStates, ...settings.states])]

  let federal: Awaited<ReturnType<typeof federalGrants>> | null = null
  try {
    federal = await federalGrants()
  } catch (err) {
    console.error('[grants] federal load failed', err)
  }
  const checkedAt = federal?.checkedAt ?? new Date(0).toISOString()
  const today = checkedAt.slice(0, 10)
  const all: Grant[] = [...(federal?.grants ?? []), ...directoryGrants(states, today), ...customGrants(settings, today)]
  const fits = (g: Grant) => !purpose || g.purposes.includes(purpose)
  const shortlist = all.filter((g) => settings.saved.includes(g.id))
  const visible = all.filter((g) => fits(g) && !settings.saved.includes(g.id) && !settings.dismissed.includes(g.id))
  // "Within 30 days" is measured from when the federal list was checked.
  const soonBefore = new Date(new Date(checkedAt).getTime() + 30 * DAY).toISOString().slice(0, 10)
  const href = (p?: GrantPurpose) => (p ? `?purpose=${p}` : '?')
  const sources: GrantSource[] = ['federal', 'state', 'foundation', 'yours']

  // The free plan (owner decision 2026-11-17): the first two grants in full, a few more blurred, and the count of the rest.
  if (freeShown !== null) {
    const open = visible.slice(0, freeShown)
    const blurred = visible.slice(freeShown, freeShown + 4)
    const more = Math.max(0, visible.length - open.length)
    return (
      <div className="space-y-6">
        <p className="max-w-3xl text-sm text-muted-foreground">
          Funding {ctx.institution.name} can apply for{isCollege ? ' as a college or university' : ''}, matched to retraining, entrepreneurship and research.
          Federal notices are live from Grants.gov; state and foundation programs are checked by hand. Confirm details in the official notice before you apply.
        </p>
        {open.length ? (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {open.map((g) => (
              <GrantRow key={g.id} g={g} slug={slug} saved={false} canWrite={false} soonBefore={soonBefore} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={HandCoins} title="No grants to show right now" description={federal ? 'Nothing current matches yet. New notices arrive every day.' : 'Grants.gov isn’t answering right now. Try again in a few minutes.'} />
        )}
        {more > 0 && (
          <section aria-label="More grants" className="space-y-3">
            <p className="text-sm font-medium">
              {more.toLocaleString()} more {more === 1 ? 'grant fits' : 'grants fit'} {ctx.institution.name}.
            </p>
            <div className="relative">
              <ul aria-hidden="true" className="pointer-events-none divide-y divide-border rounded-lg border border-border bg-card blur-sm select-none">
                {blurred.map((g) => (
                  <li key={g.id} className="space-y-1 p-4">
                    <p className="font-medium">{g.title}</p>
                    <p className="text-xs text-muted-foreground">{SOURCE_LABELS[g.source]} · {g.agency}</p>
                  </li>
                ))}
              </ul>
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <LockedFeature feature="grants" slug={slug} plan={ctx.institution.plan} trial={trialForLock(ctx.institution)} compact />
              </div>
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Funding {ctx.institution.name} can apply for{isCollege ? ' as a college or university' : ''}, matched to retraining, entrepreneurship and research. Federal notices are live
        from Grants.gov, checked every 12 hours. State and foundation programs are a directory NextChapter checks by hand on each funder’s own page, for{' '}
        {states.length ? states.join(', ') : 'your state'} and national foundations; each shows when it was checked. Confirm details in the official notice
        before you apply.
      </p>

      <nav aria-label="Purpose" className="flex flex-wrap gap-2">
        {[{ key: undefined, label: 'All' }, ...GRANT_PURPOSES].map((p) => {
          const active = p.key === purpose
          return (
            <Link
              key={p.label}
              href={href(p.key)}
              aria-current={active ? 'page' : undefined}
              className={cn('rounded-md border px-3 py-1.5 text-sm', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-muted')}
            >
              {p.label}
            </Link>
          )
        })}
      </nav>

      {shortlist.length > 0 && (
        <section aria-labelledby="grants-short" className="space-y-2">
          <h2 id="grants-short" className="text-base font-semibold">
            Your shortlist
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {shortlist.map((g) => (
              <GrantRow key={g.id} g={g} slug={slug} saved canWrite={canWrite} soonBefore={soonBefore} />
            ))}
          </ul>
        </section>
      )}

      {sources.map((src) => {
        const rows = visible.filter((g) => g.source === src)
        const heading = src === 'state' ? `State programs${states.length ? ` (${states.join(', ')})` : ''}` : SOURCE_LABELS[src]
        if (src === 'yours' && !rows.length && !canWrite) return null
        return (
          <section key={src} aria-labelledby={`grants-${src}`} className="space-y-2">
            <h2 id={`grants-${src}`} className="text-base font-semibold">
              {heading} <span className="text-sm font-normal text-muted-foreground">{rows.length}</span>
            </h2>
            {src === 'federal' && !federal ? (
              <EmptyState icon={HandCoins} title="Grants.gov isn’t answering right now" description="Try again in a few minutes. State, foundation and your own grants are below." />
            ) : rows.length ? (
              <>
                {src === 'federal' && federal && federal.failed > 0 && <p className="text-xs text-muted-foreground">Some searches didn’t answer this time, so this list may be short.</p>}
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {rows.map((g) => (
                    <GrantRow key={g.id} g={g} slug={slug} saved={false} canWrite={canWrite} soonBefore={soonBefore} />
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {src === 'state'
                  ? states.length
                    ? 'None in the directory for these states and this purpose yet.'
                    : 'Your state isn’t set. Add it below, or ask NextChapter to set your region.'
                  : src === 'yours'
                    ? 'Add a grant your team found and everyone in Development sees it here.'
                    : 'Nothing current for this purpose.'}
              </p>
            )}
            {src === 'yours' && canWrite && (
              <details className="rounded-lg border border-border bg-card p-4">
                <summary className="cursor-pointer text-sm font-medium text-primary">Add a grant</summary>
                <div className="mt-3">
                  <AddGrantForm slug={slug} />
                </div>
              </details>
            )}
          </section>
        )
      })}

      {canWrite && (
        <section aria-label="Settings" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <GrantStatesForm slug={slug} current={settings.states} own={ownStates} />
          {settings.dismissed.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {settings.dismissed.length} hidden.{' '}
              {all
                .filter((g) => settings.dismissed.includes(g.id))
                .slice(0, 10)
                .map((g) => (
                  <span key={g.id} className="mr-2 inline-flex items-center gap-1">
                    {g.title.slice(0, 40)}
                    {g.title.length > 40 ? '…' : ''} <ActionButton label="Show" variant="ghost" done="Shown again." run={markGrant.bind(null, slug, g.id, 'undismiss', g.purposes)} />
                  </span>
                ))}
            </p>
          )}
        </section>
      )}
    </div>
  )
}
