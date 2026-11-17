// Development › Grants and RFPs: current federal funding the college can apply
// for, matched to retraining, entrepreneurship and research. Live from
// Grants.gov (cached 12 hours); the college keeps a shortlist and hides what
// doesn't fit.

import Link from 'next/link'
import { HandCoins } from 'lucide-react'
import type { WorkspaceContext } from '@/lib/higher-ed/access'
import { prisma } from '@/lib/prisma'
import { federalGrants, grantSettingsFrom, GRANT_PURPOSES, type Grant, type GrantPurpose } from '@/lib/higher-ed/grants'
import { markGrant } from '@/app/i/[slug]/(portal)/development-actions'
import { EmptyState } from '@/components/ui/empty-state'
import { ActionButton } from './CommunityForms'
import { cn } from '@/lib/utils'

type Props = { ctx: WorkspaceContext; base: string; searchParams?: { purpose?: string } }

const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const fmt = (iso: string | null) => (iso ? dateFmt.format(new Date(`${iso}T00:00:00Z`)) : null)
const DAY = 86_400_000

function GrantRow({ g, slug, saved, canWrite, soonBefore }: { g: Grant; slug: string; saved: boolean; canWrite: boolean; soonBefore: string }) {
  const closes = fmt(g.closeDate)
  const soon = !!g.closeDate && g.closeDate < soonBefore
  const labels = g.purposes.map((p) => GRANT_PURPOSES.find((x) => x.key === p)?.label ?? p).join(', ')
  return (
    <li className="space-y-1 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <a href={g.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
          {g.title}
        </a>
        {canWrite && (
          <span className="flex gap-2">
            <ActionButton label={saved ? 'Remove from shortlist' : 'Add to shortlist'} variant={saved ? 'ghost' : 'outline'} run={markGrant.bind(null, slug, g.id, saved ? 'unsave' : 'save', g.purposes)} />
            {!saved && <ActionButton label="Hide" variant="ghost" done="Hidden." run={markGrant.bind(null, slug, g.id, 'dismiss', g.purposes)} />}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {g.agency} · {g.number} · For {labels}
      </p>
      <p className={cn('text-xs', soon ? 'font-medium text-foreground' : 'text-muted-foreground')}>
        {g.status === 'forecasted' ? 'Forecast: not open yet' : closes ? `Closes ${closes}${soon ? ', within 30 days' : ''}` : 'Open, no closing date given'}
      </p>
    </li>
  )
}

export async function DevelopmentGrants({ ctx, searchParams }: Props) {
  const slug = ctx.institution.slug
  const canWrite = !ctx.readOnly && (ctx.tokens.has('DEVELOPMENT') || ctx.tokens.has('INSTITUTION_ADMIN'))
  const purpose = GRANT_PURPOSES.find((p) => p.key === searchParams?.purpose)?.key as GrantPurpose | undefined
  const row = await prisma.institution.findUniqueOrThrow({ where: { id: ctx.institution.id }, select: { enabledFeatures: true } })
  const settings = grantSettingsFrom(row.enabledFeatures)
  let data: Awaited<ReturnType<typeof federalGrants>> | null = null
  try {
    data = await federalGrants()
  } catch (err) {
    console.error('[grants] load failed', err)
  }
  const href = (p?: GrantPurpose) => (p ? `?purpose=${p}` : '?')
  const all = data?.grants ?? []
  const shown = all.filter((g) => !settings.dismissed.includes(g.id) && (!purpose || g.purposes.includes(purpose)))
  const shortlist = all.filter((g) => settings.saved.includes(g.id))
  const rest = shown.filter((g) => !settings.saved.includes(g.id))
  // "Within 30 days" is measured from when the list was checked.
  const soonBefore = new Date(new Date(data?.checkedAt ?? 0).getTime() + 30 * DAY).toISOString().slice(0, 10)

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Federal grants and funding notices {ctx.institution.name} is eligible for as a college or university, matched to retraining, entrepreneurship and research.
        Live from Grants.gov, checked every 12 hours. State and foundation funding are not included yet. Confirm each in its official notice before you apply.
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
      {purpose && <p className="text-xs text-muted-foreground">{GRANT_PURPOSES.find((p) => p.key === purpose)?.blurb}</p>}

      {!data ? (
        <EmptyState icon={HandCoins} title="Grants.gov isn’t answering right now" description="Try again in a few minutes. Your shortlist is kept." />
      ) : (
        <>
          {data.failed > 0 && <p className="text-xs text-muted-foreground">Some searches didn’t answer this time, so the list may be short. It refreshes within 12 hours.</p>}
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
          <section aria-labelledby="grants-all" className="space-y-2">
            <h2 id="grants-all" className="text-base font-semibold">
              {rest.length} current {rest.length === 1 ? 'opportunity' : 'opportunities'}
            </h2>
            {rest.length ? (
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {rest.map((g) => (
                  <GrantRow key={g.id} g={g} slug={slug} saved={false} canWrite={canWrite} soonBefore={soonBefore} />
                ))}
              </ul>
            ) : (
              <EmptyState icon={HandCoins} title="Nothing open for this purpose" description="New notices appear here as agencies post them." />
            )}
          </section>
          {settings.dismissed.length > 0 && canWrite && (
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
        </>
      )}
    </div>
  )
}
