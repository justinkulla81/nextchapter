import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { addVoice, dismissSuggestion, setVoiceStatus } from './actions'

export const maxDuration = 30

const fmt = (d: Date | null) => (d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : 'date TBA')
const ago = (d: Date | null) => (d ? `${Math.max(0, Math.round((Date.now() - d.getTime()) / 86_400_000))} days ago` : 'not yet')

/**
 * Thought leaders in AI-and-work, workforce and higher ed, and the stages they are booked on, so no conference, host
 * or panel they attend is missed. A weekly search fills it in; new names it keeps seeing wait here for a yes.
 */
export default async function VoicesPage() {
  const admin = await requireAdmin()
  const now = new Date()
  const yearAgo = new Date(now.getTime() - 365 * 86_400_000)
  const voices = await prisma.speakerWatch.findMany({
    orderBy: { name: 'asc' },
    include: { appearances: { where: { OR: [{ eventDate: { gte: yearAgo } }, { eventDate: null }] }, orderBy: { eventDate: 'desc' } } },
  })
  const suggested = voices.filter((v) => v.status === 'SUGGESTED')
  const active = voices.filter((v) => v.status === 'ACTIVE')
  const paused = voices.filter((v) => v.status === 'PAUSED' && v.source !== 'DISCOVERY')

  const upcoming = active.flatMap((v) => v.appearances.filter((a) => a.eventDate && a.eventDate >= now).map((a) => ({ ...a, who: v.name })))
    .sort((a, b) => a.eventDate!.getTime() - b.eventDate!.getTime())
  const hostCount = new Map<string, Set<string>>()
  for (const v of active) for (const a of v.appearances) if (a.hostName) (hostCount.get(a.hostName) ?? hostCount.set(a.hostName, new Set()).get(a.hostName)!).add(v.name)
  const hosts = [...hostCount.entries()].filter(([, s]) => s.size >= 2).sort((a, b) => b[1].size - a[1].size).slice(0, 12)

  captureServerEvent(admin.email ?? 'admin', 'speaker_voices_viewed', { active: active.length, suggested: suggested.length, upcoming: upcoming.length })
  const input = 'mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground'

  return (
    <div className="space-y-6">
      <nav className="text-sm"><Link href="/support/admin/crm/speaking" className="text-muted-foreground hover:underline">← Speaking & applications</Link></nav>
      <header>
        <h1 className="text-2xl font-semibold">Voices to watch</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Thought leaders in AI and work, workforce and higher ed, and where they speak. Each week a search checks the least recently
          checked of them; a stage they are booked on that you have not seen lands on the speaking list (and a to-do) marked with who is on it.
        </p>
      </header>

      {suggested.length > 0 && (
        <section className="space-y-2 rounded-lg border border-orange/50 bg-orange/5 p-3">
          <h2 className="text-sm font-semibold">Suggested voices · {suggested.length}</h2>
          <ul className="space-y-2">
            {suggested.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span><b>{v.name}</b>{[v.org, v.title].filter(Boolean).length > 0 && <span className="text-muted-foreground"> · {[v.org, v.title].filter(Boolean).join(', ')}</span>}{v.note && <span className="block text-xs text-muted-foreground">{v.note}</span>}</span>
                <span className="flex gap-2">
                  <form action={setVoiceStatus.bind(null, v.id, 'ACTIVE')}><button type="submit" className="cursor-pointer rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">Follow</button></form>
                  <form action={dismissSuggestion.bind(null, v.id)}><button type="submit" className="cursor-pointer rounded-md border border-border bg-background px-2.5 py-1 text-xs hover:bg-muted">Not now</button></form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form action={addVoice} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6">
        <label className="text-xs text-muted-foreground sm:col-span-2">Name<input name="name" required maxLength={200} className={input} /></label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Organization (optional)<input name="org" className={input} /></label>
        <label className="text-xs text-muted-foreground sm:col-span-2">Known for (optional)<input name="topics" className={input} /></label>
        <div className="sm:col-span-6"><button type="submit" className="cursor-pointer rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">Follow this person</button></div>
      </form>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Coming up · {upcoming.length}</h2>
        {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">Nothing booked that the search has found yet.</p> : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {upcoming.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 p-3">
                <span><b>{a.who}</b> · {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="underline">{a.eventName}</a> : a.eventName}<span className="text-xs text-muted-foreground"> · {a.role.toLowerCase()}{a.hostName ? ` · ${a.hostName}` : ''}{a.location ? ` · ${a.location}` : ''}</span></span>
                <span className="text-xs text-muted-foreground">{fmt(a.eventDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {hosts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Hosts that book several of them</h2>
          <ul className="flex flex-wrap gap-2 text-sm">{hosts.map(([h, s]) => <li key={h} className="rounded-md border border-border px-3 py-1.5" title={[...s].join(', ')}>{h} · {s.size}</li>)}</ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Everyone you follow · {active.length}</h2>
        <ul className="space-y-2">
          {active.map((v) => (
            <li key={v.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p>
                  {v.crmPersonId ? <Link href={`/support/admin/crm/people/${v.crmPersonId}`} className="font-medium underline">{v.name}</Link> : <b>{v.name}</b>}
                  <span className="text-muted-foreground">{[v.org, v.topics].filter(Boolean).length > 0 && ` · ${[v.org, v.topics].filter(Boolean).join(' · ')}`}</span>
                </p>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  Checked {ago(v.lastCheckedAt)}
                  <form action={setVoiceStatus.bind(null, v.id, 'PAUSED')}><button type="submit" className="cursor-pointer underline">Pause</button></form>
                </span>
              </div>
              {v.appearances.length > 0 && (
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {v.appearances.slice(0, 5).map((a) => (
                    <li key={a.id}>{fmt(a.eventDate)} · {a.url ? <a href={a.url} target="_blank" rel="noopener noreferrer" className="underline">{a.eventName}</a> : a.eventName}{a.hostName ? ` · ${a.hostName}` : ''}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      {paused.length > 0 && (
        <section className="space-y-1 text-sm text-muted-foreground">
          <h2 className="text-sm font-semibold">Paused</h2>
          <ul className="flex flex-wrap gap-3">{paused.map((v) => <li key={v.id}>{v.name} <form action={setVoiceStatus.bind(null, v.id, 'ACTIVE')} className="inline"><button type="submit" className="cursor-pointer underline">Resume</button></form></li>)}</ul>
        </section>
      )}
    </div>
  )
}
