'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { approveLayoffOutreach, skipLayoffMatches } from '@/app/i/[slug]/(portal)/outreach-actions'

export type LayoffGroup = {
  noticeId: string
  employer: string
  where: string | null
  noticeDate: string | null
  employees: number | null
  sourceUrl: string | null
  matches: { id: string; name: string; classYear: number | null }[]
}

// New layoff matches, grouped by notice. Pick people (all are picked to
// start), then send the "has your back" email or skip them. Sending is a
// confirm step because email can't be unsent.
export function LayoffInbox({ slug, groups, isDemo, readOnly }: { slug: string; groups: LayoffGroup[]; isDemo: boolean; readOnly: boolean }) {
  const all = groups.flatMap((g) => g.matches.map((m) => m.id))
  const [picked, setPicked] = useState<Set<string>>(new Set(all))
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  const toggle = (ids: string[], on: boolean) =>
    setPicked((p) => {
      const n = new Set(p)
      for (const id of ids) (on ? n.add(id) : n.delete(id))
      return n
    })
  const run = (fn: () => Promise<{ error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn()
      setMessage(r.error ? { text: r.error, error: true } : { text: r.message ?? 'Done.', error: false })
      setConfirming(false)
    })
  const ids = [...picked]

  return (
    <div className={cn('space-y-4', pending && 'cursor-wait')}>
      {groups.map((g) => {
        const groupIds = g.matches.map((m) => m.id)
        const allOn = groupIds.every((id) => picked.has(id))
        return (
          <section key={g.noticeId} className="rounded-lg border border-border bg-card p-4" aria-label={`Layoffs at ${g.employer}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-semibold">{g.employer}</h3>
                <p className="text-xs text-muted-foreground">
                  {[g.noticeDate && `Filed ${g.noticeDate}`, g.where, g.employees && `${g.employees.toLocaleString()} employees affected`].filter(Boolean).join(' · ')}
                  {g.sourceUrl && (
                    <>
                      {' · '}
                      <a href={g.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                        Notice
                      </a>
                    </>
                  )}
                </p>
              </div>
              {!readOnly && (
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={allOn} onChange={(e) => toggle(groupIds, e.target.checked)} />
                  All {g.matches.length}
                </label>
              )}
            </div>
            <ul className="mt-3 grid gap-1 sm:grid-cols-2">
              {g.matches.map((m) => (
                <li key={m.id}>
                  <label className="flex items-center gap-2 text-sm">
                    {!readOnly && <input type="checkbox" checked={picked.has(m.id)} onChange={(e) => toggle([m.id], e.target.checked)} />}
                    {m.name}
                    {m.classYear && <span className="text-xs text-muted-foreground">&rsquo;{String(m.classYear).slice(2)}</span>}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
      {!readOnly &&
        (confirming ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">
              {isDemo
                ? `Record the layoff email for ${ids.length} alumni? Nothing is emailed on a demo.`
                : `Email ${ids.length} alumni "If you're affected, we have your back"? It can't be unsent.`}
            </span>
            <Button disabled={pending} onClick={() => run(() => approveLayoffOutreach(slug, ids))}>
              {pending ? 'Sending…' : isDemo ? 'Record emails' : 'Send emails'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending} autoFocus>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!ids.length || pending} onClick={() => setConfirming(true)}>
              Send outreach to {ids.length}
            </Button>
            <Button variant="outline" disabled={!ids.length || pending} onClick={() => run(() => skipLayoffMatches(slug, ids))}>
              Skip {ids.length}
            </Button>
            {!ids.length && <span className="text-xs text-muted-foreground">Pick at least one person.</span>}
          </div>
        ))}
      {message && (
        <p role={message.error ? 'alert' : 'status'} className={cn('text-sm', message.error ? 'text-destructive' : 'text-muted-foreground')}>
          {message.text}
        </p>
      )}
    </div>
  )
}
