'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { posthog } from '@/lib/posthog/client'
import { createPartnerView, revokePartnerView, type HubResult } from '@/app/i/[slug]/(portal)/hub-actions'
import { DEFAULT_SCOPES, EXPIRY_DAYS, PARTNER_KINDS, VIEW_SCOPES } from '@/lib/workforce/partner-views'

function Msg({ r }: { r: HubResult }) {
  if (!r?.error && !r?.message) return null
  return (
    <p role={r.error ? 'alert' : 'status'} className={cn('text-sm', r.error ? 'text-destructive' : 'text-muted-foreground')}>
      {r.error ?? r.message}
    </p>
  )
}

// Make a partner view. Who it is for and how long it lasts are two to three choices, so they are buttons side by side.
export function PartnerViewForm({ slug, partners = [] }: { slug: string; partners?: { id: string; name: string }[] }) {
  const [state, action] = useActionState<HubResult, FormData>(createPartnerView.bind(null, slug), undefined)
  const [kind, setKind] = useState<string>('COLLEGE')
  const [name, setName] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [days, setDays] = useState<number>(30)
  const [scopes, setScopes] = useState<string[]>(DEFAULT_SCOPES.COLLEGE)
  const pickKind = (k: string) => {
    setKind(k)
    setScopes(DEFAULT_SCOPES[k] ?? ['SKILLS'])
  }
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pv-name">Who is it for?</Label>
        <Input id="pv-name" name="partnerName" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="For example, Jefferson Community and Technical College" />
      </div>
      {partners.length > 0 && (
        <div className="space-y-1.5">
          <Label htmlFor="pv-partner">Is it for a partner with its own page? (optional)</Label>
          <select
            id="pv-partner"
            name="ecosystemPartnerId"
            value={partnerId}
            onChange={(e) => {
              setPartnerId(e.target.value)
              const p = partners.find((x) => x.id === e.target.value)
              if (p) setName(p.name)
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">No, just a link</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">The view also appears on that partner’s own page, under Shared with you.</p>
        </div>
      )}
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Kind of partner</legend>
        <input type="hidden" name="partnerKind" value={kind} />
        <div className="flex flex-wrap gap-2">
          {PARTNER_KINDS.map((k) => (
            <Button key={k.key} type="button" size="sm" variant={kind === k.key ? 'default' : 'outline'} aria-pressed={kind === k.key} onClick={() => pickKind(k.key)}>
              {k.label}
            </Button>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">What to include</legend>
        {VIEW_SCOPES.map((s) => (
          <label key={s.key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="scopes"
              value={s.key}
              checked={scopes.includes(s.key)}
              onChange={(e) => setScopes((cur) => (e.target.checked ? [...cur, s.key] : cur.filter((x) => x !== s.key)))}
              className="mt-0.5"
            />
            <span>{s.label}</span>
          </label>
        ))}
        <p className="text-xs text-muted-foreground">Everything is counts or coarse groups. A group of fewer than five people is hidden, and no one is named.</p>
      </fieldset>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">The link works for</legend>
        <input type="hidden" name="days" value={days} />
        <div className="flex gap-2">
          {EXPIRY_DAYS.map((d) => (
            <Button key={d} type="button" size="sm" variant={days === d ? 'default' : 'outline'} aria-pressed={days === d} onClick={() => setDays(d)}>
              {d} days
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="pv-note">A note at the top (optional)</Label>
        <Input id="pv-note" name="note" maxLength={500} placeholder="Why you are sharing this, or what to look at first" />
      </div>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Making the link…">Make the link</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function CopyLink({ url, viewId, slug }: { url: string; viewId: string; slug: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
          posthog.capture('partner_view_link_copied', { slug, viewId })
          setTimeout(() => setCopied(false), 2000)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  )
}

export function RevokeViewButton({ slug, id, name }: { slug: string; id: string; name: string }) {
  const [state, action] = useActionState<HubResult, FormData>(revokePartnerView.bind(null, slug), undefined)
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Switch off the view for ${name}? The link stops working at once.`)) e.preventDefault()
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="ghost" pendingLabel="Switching off…">
        Switch off
      </SubmitButton>
      <Msg r={state} />
    </form>
  )
}
