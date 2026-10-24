import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { interestCounts, listEvents, seedCatalogIfStale } from '@/lib/events/store'
import { ACCESS_LABEL, SPEAKING_LABEL, type Access, type Speaking } from '@/lib/events/types'
import { costLabel, whenLabel, whereLabel } from '@/lib/events/format'
import { INDUSTRY_BUCKET_NAMES } from '@/lib/constants/industry-buckets'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { setPublished } from './actions'

export const maxDuration = 30

/**
 * Conferences, trade shows and summits by industry, function and seniority. Candidates see only the
 * published rows (Network, Events to attend). Cost, speaking path and how to get in are on every row.
 */
export default async function CrmEventsPage({ searchParams }: { searchParams: Promise<{ function?: string; industry?: string; show?: string; access?: string; q?: string }> }) {
  await requireAdmin()
  const sp = await searchParams
  const fn = PRIMARY_FUNCTION_OPTIONS.find((f) => f === sp.function)
  const ind = INDUSTRY_BUCKET_NAMES.find((i) => i === sp.industry)
  const show = ['published', 'hidden', 'unverified', 'call'].includes(sp.show ?? '') ? sp.show : undefined
  const access = (Object.keys(ACCESS_LABEL) as Access[]).find((a) => a === sp.access)
  const q = sp.q?.slice(0, 80).toLowerCase()

  let rows: Awaited<ReturnType<typeof listEvents>> = []
  let counts: Awaited<ReturnType<typeof interestCounts>> = {}
  let missing = false
  let loadError = ''
  try {
    await seedCatalogIfStale()
    ;[rows, counts] = await Promise.all([listEvents(), interestCounts()])
  } catch (e) {
    missing = true
    loadError = e instanceof Error ? e.message.slice(0, 600) : String(e)
  }
  const total = rows.length
  const rows0 = rows
  rows = rows.filter(
    (r) =>
      (!fn || r.functions.length === 0 || r.functions.includes(fn)) &&
      (!ind || r.industries.length === 0 || r.industries.includes(ind)) &&
      (!access || r.access === access) &&
      (show !== 'published' || r.published) &&
      (show !== 'hidden' || !r.published) &&
      (show !== 'unverified' || !r.verified) &&
      (show !== 'call' || (r.adminNote ?? '').startsWith('JUMP BALL')) &&
      (!q || `${r.name} ${r.organizer ?? ''} ${r.city ?? ''} ${r.segments.join(' ')} ${r.roles.join(' ')}`.toLowerCase().includes(q)),
  )

  const href = (o: Record<string, string | undefined>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries({ function: fn, industry: ind, show, access, q: sp.q, ...o })) if (v) p.set(k, v)
    const s = p.toString()
    return `/support/admin/crm/events${s ? `?${s}` : ''}`
  }
  const chip = (active: boolean) => `rounded-md border px-2.5 py-1 text-xs ${active ? 'border-foreground bg-muted font-medium' : 'border-border hover:bg-muted'}`
  const publishedCount = rows.filter((r) => r.published).length

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Events</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Conferences, trade shows and summits worth attending to network or speak, by industry, function and seniority. Candidates see the
            published rows at Network, Events to attend. Each row says what it costs, whether there is a cheaper way in, and how to speak or get invited.
            Publish only what you have checked on the event&apos;s own site.
          </p>
        </div>
        <Link href="/support/admin/crm/events/reminders" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">Reminder preview</Link>
        <Link href="/support/admin/crm/events/coverage" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">Coverage map</Link>
        <Link href="/support/admin/crm/events/new" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">Add an event</Link>
      </header>

      {missing ? (
        <p className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          The events could not be loaded. If the ConferenceEvent tables are missing, run <code>prisma/manual/conference-events.sql</code>; otherwise this is the error:
          <code className="mt-2 block whitespace-pre-wrap break-words text-xs">{loadError}</code>
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <form action="/support/admin/crm/events" className="flex flex-wrap items-center gap-2">
              {show && <input type="hidden" name="show" value={show} />}
              {access && <input type="hidden" name="access" value={access} />}
              <input name="q" defaultValue={sp.q} placeholder="Search events" className="w-44 rounded-md border border-border bg-background px-2 py-1 text-xs" />
              <select name="function" defaultValue={fn ?? ''} className="rounded-md border border-border bg-background px-2 py-1 text-xs">
                <option value="">Any function</option>
                {PRIMARY_FUNCTION_OPTIONS.map((f) => <option key={f}>{f}</option>)}
              </select>
              <select name="industry" defaultValue={ind ?? ''} className="max-w-52 rounded-md border border-border bg-background px-2 py-1 text-xs">
                <option value="">Any industry</option>
                {INDUSTRY_BUCKET_NAMES.map((i) => <option key={i}>{i}</option>)}
              </select>
              <button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted">Filter</button>
            </form>
            <Link href={href({ show: '' })} className={chip(!show)}>All ({total})</Link>
            <Link href={href({ show: 'published' })} className={chip(show === 'published')}>Published</Link>
            <Link href={href({ show: 'hidden' })} className={chip(show === 'hidden')}>Hidden</Link>
            <Link href={href({ show: 'unverified' })} className={chip(show === 'unverified')}>Not verified</Link>
            <Link href={href({ show: 'call' })} className={chip(show === 'call')}>Needs your call ({rows0.filter((r) => (r.adminNote ?? '').startsWith('JUMP BALL')).length})</Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={href({ access: '' })} className={chip(!access)}>Any access</Link>
            {(Object.keys(ACCESS_LABEL) as Access[]).map((a) => <Link key={a} href={href({ access: a })} className={chip(access === a)}>{ACCESS_LABEL[a]}</Link>)}
          </div>
          <p className="text-xs text-muted-foreground">{rows.length} match{rows.length > 250 ? ' (first 250 listed, narrow with the filters)' : ''}, {publishedCount} visible to candidates.</p>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{total === 0 ? 'No events yet.' : 'Nothing matches.'}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {rows.slice(0, 250).map((r) => {
                const c = counts[r.id]
                return (
                  <li key={r.id} className="space-y-1 p-3 text-sm">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Link href={`/support/admin/crm/events/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                      {r.organizer && <span className="text-xs text-muted-foreground">{r.organizer}</span>}
                      <span className="text-xs text-muted-foreground">{whenLabel(r)} · {whereLabel(r)}</span>
                      {c && <span className="text-xs text-muted-foreground">{c.going} going, {c.saved} saved{c.speaking ? `, ${c.speaking} speaking` : ''}{c.following ? `, ${c.following} following` : ''}{c.attended ? `, ${c.attended} went before` : ''}{c.spoke ? `, ${c.spoke} spoke` : ''}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="rounded border border-border px-1.5 py-0.5">{ACCESS_LABEL[r.access as Access] ?? r.access}</span>
                      <span>{costLabel(r)}</span>
                      <span>{SPEAKING_LABEL[r.speaking as Speaking] ?? r.speaking}</span>
                      <span>Importance {r.importance}</span>
                      <span className={r.verified ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                        {r.verified ? 'Verified' : 'Not verified: check before publishing'}
                      </span>
                    </div>
                    {(r.adminNote ?? '').startsWith('JUMP BALL') && <p className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-100">{r.adminNote}</p>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{r.functions.length ? r.functions.join(', ') : 'Every function'}</span>
                      <span>·</span>
                      <span>{r.industries.length ? r.industries.join(', ') : 'Every industry'}</span>
                      <span>·</span>
                      <span>{r.seniorities.length ? r.seniorities.map((s) => s.toLowerCase()).join(', ') : 'Every level'}</span>
                    </div>
                    <form action={setPublished} className="flex items-center gap-2 pt-1">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="publish" value={r.published ? '0' : '1'} />
                      <button disabled={!r.published && !r.url} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50">
                        {r.published ? 'Hide from candidates' : 'Publish to candidates'}
                      </button>
                      {!r.published && !r.url && <span className="text-xs text-muted-foreground">Add the event link first.</span>}
                      {r.published && <span className="text-xs text-emerald-700 dark:text-emerald-400">Visible to candidates</span>}
                    </form>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
