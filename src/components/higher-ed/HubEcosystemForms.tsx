'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { posthog } from '@/lib/posthog/client'
import { addEcosystemPartner, createInvite, decideClaim, removeEcosystemPartner, seedEcosystem, type HubResult } from '@/app/i/[slug]/(portal)/hub-actions'
import { ECO_KINDS } from '@/lib/workforce/ecosystem'

function Msg({ r }: { r: HubResult }) {
  if (!r?.error && !r?.message) return null
  return (
    <p role={r.error ? 'alert' : 'status'} className={cn('text-xs', r.error ? 'text-destructive' : 'text-muted-foreground')}>
      {r.error ?? r.message}
    </p>
  )
}

export function AddPartnerForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<HubResult, FormData>(addEcosystemPartner.bind(null, slug), undefined)
  const [kind, setKind] = useState('EMPLOYER')
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="eco-name">Organization</Label>
          <Input id="eco-name" name="name" required maxLength={160} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="eco-web">Website (helps check who claims it)</Label>
          <Input id="eco-web" name="website" maxLength={200} placeholder="example.org" />
        </div>
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Kind</legend>
        <input type="hidden" name="kind" value={kind} />
        <div className="flex flex-wrap gap-2">
          {ECO_KINDS.map((k) => (
            <Button key={k.key} type="button" size="sm" variant={kind === k.key ? 'default' : 'outline'} aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
              {k.label}
            </Button>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Adding…">Add to the directory</SubmitButton>
        <Msg r={state} />
      </div>
    </form>
  )
}

export function SeedButton({ slug }: { slug: string }) {
  const [state, action] = useActionState<HubResult, FormData>(seedEcosystem.bind(null, slug), undefined)
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton variant="outline" pendingLabel="Adding…">
        Fill from public data
      </SubmitButton>
      <span className="text-xs text-muted-foreground">Adds the colleges in your region and your member companies. Nothing is sent to anyone.</span>
      <Msg r={state} />
    </form>
  )
}

export function InviteButton({ slug, id, again }: { slug: string; id: string; again: boolean }) {
  const [state, action] = useActionState<HubResult, FormData>(createInvite.bind(null, slug), undefined)
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant={again ? 'ghost' : 'outline'} pendingLabel="Making the link…">
        {again ? 'Remake link' : 'Invite'}
      </SubmitButton>
      <Msg r={state} />
    </form>
  )
}

export function CopyText({ text, label, partnerId, slug, what }: { text: string; label: string; partnerId: string; slug: string; what: 'link' | 'message' }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          posthog.capture('ecosystem_invite_copied', { slug, partnerId, what })
          setTimeout(() => setCopied(false), 2000)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? 'Copied' : label}
    </Button>
  )
}

export function DecideButtons({ slug, id, name }: { slug: string; id: string; name: string }) {
  const [state, action] = useActionState<HubResult, FormData>(decideClaim.bind(null, slug), undefined)
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const d = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')
        if (d === 'decline' && !window.confirm(`Decline ${name}? They are not told; you can invite them again later.`)) e.preventDefault()
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" name="decision" value="confirm" size="sm">
        Confirm
      </Button>
      <Button type="submit" name="decision" value="decline" size="sm" variant="outline">
        Decline
      </Button>
      <Msg r={state} />
    </form>
  )
}

export function RemovePartnerButton({ slug, id, name }: { slug: string; id: string; name: string }) {
  const [state, action] = useActionState<HubResult, FormData>(removeEcosystemPartner.bind(null, slug), undefined)
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(`Remove ${name} from the directory? Its invitation link stops working.`)) e.preventDefault()
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton size="sm" variant="ghost" pendingLabel="Removing…">
        Remove
      </SubmitButton>
      <Msg r={state} />
    </form>
  )
}
