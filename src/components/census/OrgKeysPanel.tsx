'use client'

import { useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type OrgKeyRow = { id: string; label: string; prefix: string; createdAt: string; lastUsedAt: string | null; useCount: number; revokedAt: string | null }
type MakeKey = (label: string) => Promise<{ error?: string; token?: string }>
type TurnOff = (id: string) => Promise<{ error?: string }>

const day = (d: string | null) => (d ? new Date(d).toLocaleDateString() : 'never')

// API keys for the census hook: make one (shown once), see when each was
// last used, turn one off.
export function OrgKeysPanel({ keys, makeKey, turnOff, example }: { keys: OrgKeyRow[]; makeKey: MakeKey; turnOff: TurnOff; example: string }) {
  const [label, setLabel] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <div className="space-y-4" style={pending ? { cursor: 'wait' } : undefined}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <Label htmlFor="key-label">Name this key</Label>
          <Input id="key-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Workday" maxLength={60} />
        </div>
        <Button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErr(null)
              setCopied(false)
              const r = await makeKey(label)
              if (r.error) setErr(r.error)
              else {
                setToken(r.token ?? null)
                setLabel('')
              }
            })
          }
        >
          {pending ? 'Making key…' : 'Make an API key'}
        </Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {token && (
        <div className="space-y-2 rounded-md border border-border bg-muted p-3 text-sm">
          <p className="font-medium">Copy this key now. It won’t be shown again.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="break-all text-xs">{token}</code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(token).then(() => setCopied(true))
                posthog.capture('census_api_key_copied')
              }}
            >
              {copied ? 'Copied' : 'Copy key'}
            </Button>
          </div>
        </div>
      )}
      {keys.length === 0 ? (
        <p className="text-sm text-muted-foreground">No keys yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border text-sm">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="font-medium">
                  {k.label} <code className="text-xs text-muted-foreground">{k.prefix}…</code>
                </p>
                <p className="text-xs text-muted-foreground">
                  Made {day(k.createdAt)} · last used {day(k.lastUsedAt)} · {k.useCount} call{k.useCount === 1 ? '' : 's'}
                </p>
              </div>
              {k.revokedAt ? (
                <span className="text-xs text-muted-foreground">Off since {day(k.revokedAt)}</span>
              ) : confirm === k.id ? (
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Anything using it stops working.</span>
                  <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => start(async () => { const r = await turnOff(k.id); if (r.error) setErr(r.error); setConfirm(null) })}>
                    Turn off key
                  </Button>
                  <Button type="button" size="sm" variant="ghost" autoFocus onClick={() => setConfirm(null)}>
                    Keep it
                  </Button>
                </span>
              ) : (
                <Button type="button" size="sm" variant="outline" onClick={() => setConfirm(k.id)}>
                  Turn off
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <details className="text-sm">
        <summary className="cursor-pointer font-medium">How to send people</summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">{example}</pre>
      </details>
    </div>
  )
}

type SaveComms = (c: { joinReminders: boolean; accessEndingNotice: boolean }) => Promise<{ error?: string }>

// Opt-in census emails. Off by default; each sends real email to the org's people.
export function CommsToggles({ value, save, showAccessNotice = true }: { value: { joinReminders: boolean; accessEndingNotice: boolean }; save: SaveComms; showAccessNotice?: boolean }) {
  const [v, setV] = useState(value)
  const [err, setErr] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const set = (k: keyof typeof v, on: boolean) =>
    start(async () => {
      const next = { ...v, [k]: on }
      setErr(null)
      const r = await save(next)
      if (r.error) setErr(r.error)
      else setV(next)
    })
  const row = (k: keyof typeof v, title: string, body: string) => (
    <div className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="max-w-md">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
      <div className="flex gap-1" role="group" aria-label={title}>
        <Button type="button" size="sm" variant={v[k] ? 'default' : 'outline'} aria-pressed={v[k]} disabled={pending} onClick={() => set(k, true)}>
          On
        </Button>
        <Button type="button" size="sm" variant={!v[k] ? 'default' : 'outline'} aria-pressed={!v[k]} disabled={pending} onClick={() => set(k, false)}>
          Off
        </Button>
      </div>
    </div>
  )
  return (
    <div className="divide-y divide-border" style={pending ? { cursor: 'wait' } : undefined}>
      {row('joinReminders', 'Remind people who haven’t joined', 'Five days after the invite, and again at twelve. Two reminders at most, then we stop.')}
      {showAccessNotice && row('accessEndingNotice', 'Tell people before their access ends', 'Fourteen days before, with the date and a reminder to download their resume and notes.')}
      {err && <p className="pt-2 text-sm text-destructive">{err}</p>}
    </div>
  )
}
