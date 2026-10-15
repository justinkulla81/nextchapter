'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adminGiveAccess, adminSetGrantOn, adminSetGrantSessions } from '@/app/support/admin/(portal)/candidates/[id]/access-actions'

export type AdminGrantRow = {
  id: string
  feature: string
  source: string
  sessionsTotal: number | null
  sessionsUsed: number
  endsAt: string | null
  revokedAt: string | null
  revokedBy: string | null
  createdBy: string
}

const SOURCE: Record<string, string> = { outplacement_seat: 'Employer seat', coach_code: 'Coach code', coach: 'Coach', admin: 'NextChapter admin' }
const FEATURE: Record<string, string> = { coaching: 'Coaching', recruiters: 'Recruiter network' }

// NextChapter's own override of what someone can use, whatever gave it.
export function AdminAccessPanel({ candidateId, grants }: { candidateId: string; grants: AdminGrantRow[] }) {
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  const [feature, setFeature] = useState<'coaching' | 'recruiters'>('coaching')
  const [sessions, setSessions] = useState('6')
  const [days, setDays] = useState('')
  const run = (fn: () => Promise<{ error?: string }>) =>
    start(async () => {
      setErr(null)
      const r = await fn()
      if (r.error) setErr(r.error)
    })
  const n = (v: string) => (v.trim() === '' ? null : Number(v))

  return (
    <div className="space-y-3 text-sm" style={pending ? { cursor: 'wait' } : undefined}>
      {grants.length === 0 ? (
        <p className="text-muted-foreground">No coaching or recruiter access given. Membership access isn’t listed here.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {grants.map((g) => (
            <GrantRow key={g.id} g={g} pending={pending} onToggle={(on) => run(() => adminSetGrantOn(candidateId, g.id, on))} onSessions={(v) => run(() => adminSetGrantSessions(candidateId, g.id, v))} />
          ))}
        </ul>
      )}
      <div className="space-y-2 rounded-md border border-dashed border-border p-3">
        <p className="font-medium">Give access</p>
        <div className="flex gap-1">
          {(['coaching', 'recruiters'] as const).map((f) => (
            <Button key={f} type="button" size="sm" variant={feature === f ? 'default' : 'outline'} aria-pressed={feature === f} onClick={() => setFeature(f)}>
              {FEATURE[f]}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {feature === 'coaching' && (
            <label className="space-y-1">
              <span className="block text-xs">Sessions (blank = no limit)</span>
              <Input type="number" min={1} max={200} value={sessions} onChange={(e) => setSessions(e.target.value)} className="h-8 w-24" />
            </label>
          )}
          <label className="space-y-1">
            <span className="block text-xs">Days (blank = no end)</span>
            <Input type="number" min={1} max={730} value={days} onChange={(e) => setDays(e.target.value)} className="h-8 w-24" />
          </label>
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => adminGiveAccess(candidateId, feature, n(sessions), n(days)))}>
            {pending ? 'Giving…' : `Give ${FEATURE[feature].toLowerCase()}`}
          </Button>
        </div>
      </div>
      {err && <p className="text-destructive">{err}</p>}
    </div>
  )
}

function GrantRow({ g, pending, onToggle, onSessions }: { g: AdminGrantRow; pending: boolean; onToggle: (on: boolean) => void; onSessions: (v: number | null) => void }) {
  const [v, setV] = useState(g.sessionsTotal === null ? '' : String(g.sessionsTotal))
  const [confirmOff, setConfirmOff] = useState(false)
  const on = !g.revokedAt
  const expired = g.endsAt && new Date(g.endsAt) <= new Date()
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-2">
      <div>
        <p className="font-medium">
          {FEATURE[g.feature] ?? g.feature} · {SOURCE[g.source] ?? g.source}
        </p>
        <p className="text-xs text-muted-foreground">
          {g.feature === 'coaching' && (g.sessionsTotal === null ? 'No session limit' : `${g.sessionsUsed} of ${g.sessionsTotal} sessions used`)}
          {g.endsAt ? ` · ${expired ? 'ended' : 'ends'} ${new Date(g.endsAt).toLocaleDateString()}` : ' · no end'}
          {g.revokedAt ? ` · off (${g.revokedBy ?? 'unknown'})` : ''}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {g.feature === 'coaching' && (
          <>
            <Input aria-label="Sessions total" type="number" min={0} max={200} value={v} onChange={(e) => setV(e.target.value)} className="h-7 w-16" />
            <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => onSessions(v.trim() === '' ? null : Number(v))}>Save</Button>
          </>
        )}
        {on ? (
          confirmOff ? (
            <>
              <Button type="button" size="xs" variant="destructive" disabled={pending} onClick={() => { setConfirmOff(false); onToggle(false) }}>Turn off</Button>
              <Button type="button" size="xs" variant="ghost" autoFocus onClick={() => setConfirmOff(false)}>Keep</Button>
            </>
          ) : (
            <Button type="button" size="xs" variant="outline" onClick={() => setConfirmOff(true)}>Turn off</Button>
          )
        ) : (
          <Button type="button" size="xs" disabled={pending} onClick={() => onToggle(true)}>Turn on</Button>
        )}
      </div>
    </li>
  )
}
