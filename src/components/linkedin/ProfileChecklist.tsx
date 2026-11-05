'use client'

import { useSyncExternalStore } from 'react'
import { CHECKS, GROUPS, TOTAL_MINUTES } from '@/lib/linkedin/guide'
import { posthog } from '@/lib/posthog/client'

const KEY = 'nc_linkedin_checks'

const CHANGED = 'nc-linkedin-checks'

function subscribe(cb: () => void) {
  window.addEventListener(CHANGED, cb)
  window.addEventListener('storage', cb)
  return () => { window.removeEventListener(CHANGED, cb); window.removeEventListener('storage', cb) }
}
/** The stored ticks as a string (a stable snapshot); empty on the server and when storage is blocked. */
function snapshot(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}

function parse(raw: string): string[] {
  try {
    const v = JSON.parse(raw || '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * The eighteen checks as a tickable list with a running score. Ticks are kept in this browser only (nothing is sent), so a visitor
 * can come back. `surface` says where it sits ('public' or 'dashboard') for the events.
 */
export function ProfileChecklist({ surface }: { surface: 'public' | 'dashboard' }) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => '')
  const done = parse(raw)
  const ready = true

  const toggle = (id: string, group: string) => {
    const on = !done.includes(id)
    const next = on ? [...done, id] : done.filter((x) => x !== id)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* private window: ticks are not kept */ }
    window.dispatchEvent(new Event(CHANGED))
    posthog.capture('linkedin_check_toggled', { checkId: id, group, done: on, doneCount: next.length, surface })
    if (on && next.length === CHECKS.length) posthog.capture('linkedin_checklist_completed', { surface })
  }

  const doneCount = ready ? done.length : 0
  const minutesLeft = CHECKS.filter((c) => !done.includes(c.id)).reduce((n, c) => n + c.minutes, 0)
  const pct = Math.round((doneCount / CHECKS.length) * 100)

  return (
    <div>
      <div className="rounded-3xl bg-tint-sky p-5" role="status" aria-live="polite">
        <p className="text-lg font-semibold text-navy">{doneCount} of {CHECKS.length} done</p>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-white" aria-hidden>
          <div className="h-full rounded-full bg-navy transition-all" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-navy">
          {doneCount === CHECKS.length ? 'Every check is done. Now keep it moving with the weekly rhythm.' : `About ${minutesLeft >= 60 ? `${Math.round(minutesLeft / 6) / 10} hours` : `${minutesLeft} minutes`} left of ${Math.round(TOTAL_MINUTES / 6) / 10} hours in all. Start with any one.`}
        </p>
      </div>
      <div className="mt-6 space-y-8">
        {GROUPS.map((g) => (
          <section key={g.key} aria-labelledby={`grp-${g.key}`}>
            <h3 id={`grp-${g.key}`} className="text-lg font-semibold text-navy">{g.label}</h3>
            <p className="text-sm text-muted-foreground">{g.line}</p>
            <ul className="mt-3 space-y-2">
              {CHECKS.filter((c) => c.group === g.key).map((c) => {
                const on = ready && done.includes(c.id)
                return (
                  <li key={c.id}>
                    <label className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border p-4 ${on ? 'border-transparent bg-tint-mint' : 'border-border bg-white'}`}>
                      <input type="checkbox" checked={on} onChange={() => toggle(c.id, g.key)} className="mt-1 h-5 w-5 shrink-0 accent-navy" />
                      <span>
                        <span className={`block text-base font-semibold text-navy ${on ? 'line-through decoration-1' : ''}`}>{c.title} <span className="text-sm font-normal text-muted-foreground">· {c.minutes} min</span></span>
                        <span className="mt-1 block text-sm text-muted-foreground">{c.why}</span>
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
