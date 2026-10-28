import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { SPEAKING_KINDS, SPEAKING_STATUSES, OPEN_STATUSES } from '@/lib/speaking/kinds'
import { addSpeakingOpportunity, saveSpeakingNote, setSpeakingStatus } from './actions'

export const maxDuration = 30

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const fmt = (d: Date | null) => (d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : null)
const FIT = ['', 'Best fit', 'Good fit', 'Stretch']
const SOURCE: Record<string, string> = { ADMIN: 'You added', CONFERENCE: 'Conference catalog', DISCOVERY: 'Weekly search' }

/**
 * Speaking, panel, research-application and demo-day spots for the CEO, found the way conferences are: some from the
 * conference catalog (calls for speakers), some from a weekly web search, some typed in. A spot Justin wants becomes a
 * to-do (area Speaking) with a due date a week before the deadline.
 */
export default async function SpeakingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await requireAdmin()
  const sp = await searchParams
  const kind = SPEAKING_KINDS.find((k) => k.key === one(sp.kind))?.key
  const show = one(sp.show) === 'all' ? 'all' : one(sp.show) === 'closed' ? 'closed' : 'open'

  const now = new Date()
  const all = await prisma.ceoSpeakingOpportunity.findMany({
    orderBy: [{ fit: 'asc' }, { deadline: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 500,
  })
  const live = all.filter((r) => !r.deadline || r.deadline >= now || !OPEN_STATUSES.includes(r.status as never))
  const rows = live
    .filter((r) => (kind ? r.kind === kind : true))
    .filter((r) => (show === 'all' ? true : show === 'closed' ? !OPEN_STATUSES.includes(r.status as never) : OPEN_STATUSES.includes(r.status as never) || r.status === 'APPLIED' || r.status === 'ACCEPTED'))

  captureServerEvent(admin.email ?? 'admin', 'ceo_speaking_viewed', { kind: kind ?? 'all', show, results: rows.length })

  const count = (k: string) => live.filter((r) => r.kind === k && OPEN_STATUSES.includes(r.status as never)).length
  const input = 'mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground'

  return (
    <div className="space-y-6">
      <nav className="text-sm"><Link href="/support/admin/crm/home" className="text-muted-foreground hover:underline">← CRM</Link></nav>
      <header>
        <h1 className="text-2xl font-semibold">Speaking & applications</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Keynotes, panels, research applications, demo days, podcasts and awards for you as CEO. Calls for speakers come from the
          conference catalog daily; a weekly search adds the rest. Tap <b>Going for it</b> and it lands on your to-do list under
          Speaking, due a week before the deadline.
        </p>
      </header>

      <p className="text-sm"><Link href="/support/admin/crm/speaking/voices" className="underline">Voices to watch</Link> <span className="text-muted-foreground">· where Simon Johnson, Molly Kinder and other thought leaders are speaking</span></p>

      <form action={addSpeakingOpportunity} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
        <label className="text-xs text-muted-foreground sm:col-span-2">Name<input name="title" required maxLength={200} placeholder="HR Tech 2027 panel" className={input} /></label>
        <label className="text-xs text-muted-foreground">Type
          <select name="kind" className={input}>{SPEAKING_KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}</select>
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-3">Link<input name="url" type="url" placeholder="https://" className={input} /></label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Host<input name="hostName" className={input} /></label>
        <label className="text-xs text-muted-foreground">Event date<input name="eventDate" type="date" className={input} /></label>
        <label className="text-xs text-muted-foreground">Deadline<input name="deadline" type="date" className={input} /></label>
        <label className="text-xs text-muted-foreground sm:col-span-4">Why it fits (optional)<input name="why" className={input} /></label>
        <div className="flex items-end sm:col-span-6"><button type="submit" className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Add and put on my to-dos</button></div>
      </form>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href={`?show=${show}`} className={`rounded-md border px-3 py-1.5 ${!kind ? 'bg-navy text-white' : 'border-border'}`}>All types</Link>
        {SPEAKING_KINDS.map((k) => (
          <Link key={k.key} href={`?kind=${k.key}&show=${show}`} title={k.hint} className={`rounded-md border px-3 py-1.5 ${kind === k.key ? 'bg-navy text-white' : 'border-border'}`}>{k.label} · {count(k.key)}</Link>
        ))}
        <span className="ml-auto flex gap-2">
          {(['open', 'closed', 'all'] as const).map((s) => (
            <Link key={s} href={`?${kind ? `kind=${kind}&` : ''}show=${s}`} className={`rounded-md border px-3 py-1.5 ${show === s ? 'bg-navy text-white' : 'border-border'}`}>{s === 'open' ? 'To act on' : s === 'closed' ? 'Passed / done' : 'Everything'}</Link>
          ))}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nothing here yet. The first catalog sync runs at 9:30 UTC daily; the weekly search runs Mondays.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const k = SPEAKING_KINDS.find((x) => x.key === r.kind)
            const days = r.deadline ? Math.ceil((r.deadline.getTime() - now.getTime()) / 86_400_000) : null
            return (
              <li key={r.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="rounded bg-light-gray px-1.5 py-0.5 text-[10px] font-semibold text-navy">{k?.label ?? r.kind}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.fit === 1 ? 'bg-orange text-navy' : 'bg-muted text-muted-foreground'}`}>{FIT[r.fit] ?? 'Good fit'}</span>
                      {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" className="underline">{r.title}</a> : <span>{r.title}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[r.hostName, r.location, r.eventDate && `Event ${fmt(r.eventDate)}`].filter(Boolean).join(' · ')}
                      {r.audience && <> · Audience: {r.audience}</>} · {SOURCE[r.source] ?? r.source}
                    </p>
                    {r.why && <p className="mt-1 text-xs">{r.why}</p>}
                  </div>
                  <div className="text-right text-xs">
                    {r.deadline ? (
                      <span className={days !== null && days <= 14 ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                        Due {fmt(r.deadline)}{days !== null && days >= 0 && <span className="block">{days} days left</span>}
                      </span>
                    ) : <span className="text-muted-foreground">No deadline listed</span>}
                    <span className="mt-1 block font-semibold">{SPEAKING_STATUSES.find((s) => s.key === r.status)?.label}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {([['PLANNING', 'Going for it'], ['APPLIED', 'Applied'], ['ACCEPTED', 'Accepted'], ['DONE', 'Done'], ['PASSED', 'Pass']] as const)
                    .filter(([s]) => s !== r.status)
                    .map(([s, label]) => (
                      <form key={s} action={setSpeakingStatus.bind(null, r.id, s)}>
                        <button type="submit" className="cursor-pointer rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted">{label}</button>
                      </form>
                    ))}
                  {r.status !== 'NEW' && (
                    <form action={setSpeakingStatus.bind(null, r.id, 'NEW')}><button type="submit" className="px-1 text-xs underline text-muted-foreground">Back to new</button></form>
                  )}
                </div>
                <form action={saveSpeakingNote.bind(null, r.id)} className="mt-2 flex gap-2">
                  <input name="notes" defaultValue={r.notes ?? ''} placeholder="Notes (topic, contact, what to submit)" className="min-w-0 flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs" />
                  <button type="submit" className="cursor-pointer rounded-md border border-border px-2 py-1 text-xs hover:bg-muted">Save</button>
                </form>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
