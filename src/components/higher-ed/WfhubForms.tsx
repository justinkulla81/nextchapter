'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { COMMIT_ROLES, COMMIT_STATUSES } from '@/lib/workforce/funding-partners'
import { CopyButton } from '@/components/ui/copy-button'
import { addCommitment, removeCommitment, setCommitmentStatus, type WfResult } from '@/app/i/[slug]/(portal)/wfhub-actions'

function Note({ state }: { state: WfResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>
  if (state?.ok && state.message) return <p role="status" className="text-sm text-muted-foreground">{state.message}</p>
  return null
}

export function AddPartnerForm({ slug, applicationId, partners }: { slug: string; applicationId: string; partners: { id: string; name: string }[] }) {
  const [state, action] = useActionState<WfResult, FormData>(addCommitment.bind(null, slug, applicationId), undefined)
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={`pn-${applicationId}`}>Partner</Label>
          <Input id={`pn-${applicationId}`} name="partnerName" list={`pl-${applicationId}`} required maxLength={120} placeholder="Choose one of your partners or type a name" />
          <datalist id={`pl-${applicationId}`}>
            {partners.map((p) => <option key={p.id} value={p.name} />)}
          </datalist>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`am-${applicationId}`}>Match in dollars (if any)</Label>
          <Input id={`am-${applicationId}`} name="amount" inputMode="numeric" placeholder="25000" />
        </div>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Their part</legend>
        <div className="flex flex-wrap gap-2">
          {COMMIT_ROLES.map((r) => (
            <label key={r.key} className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="radio" name="role" value={r.key} defaultChecked={r.key === 'PARTNER'} className="size-4" />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Where they stand</legend>
        <div className="flex flex-wrap gap-2">
          {COMMIT_STATUSES.map((s) => (
            <label key={s.key} className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10">
              <input type="radio" name="status" value={s.key} defaultChecked={s.key === 'ASKED'} className="size-4" />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1">
        <Label htmlFor={`nt-${applicationId}`}>Note (optional)</Label>
        <Input id={`nt-${applicationId}`} name="note" maxLength={400} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Adding…">Add partner</SubmitButton>
        <Note state={state} />
      </div>
    </form>
  )
}

export function StatusButtons({ slug, id, status, name }: { slug: string; id: string; status: string; name: string }) {
  const [state, action] = useActionState<WfResult, FormData>(async (prev, f) => {
    const next = String(f.get('to') ?? '')
    return setCommitmentStatus(slug, id, next, prev, f)
  }, undefined)
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      {COMMIT_STATUSES.filter((s) => s.key !== status).map((s) => (
        <button key={s.key} type="submit" name="to" value={s.key} aria-label={`Mark ${name} as ${s.label.toLowerCase()}`} className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium hover:bg-muted">
          Mark {s.label.toLowerCase()}
        </button>
      ))}
      <Note state={state} />
    </form>
  )
}

export function RemovePartnerButton({ slug, id, name }: { slug: string; id: string; name: string }) {
  const [state, action] = useActionState<WfResult, FormData>(removeCommitment.bind(null, slug, id), undefined)
  return (
    <form action={action} className="flex items-center gap-2">
      <SubmitButton size="sm" variant="ghost" pendingLabel="Removing…" aria-label={`Remove ${name} from this application`}>Remove</SubmitButton>
      <Note state={state} />
    </form>
  )
}

/** The ask for one partner: copy it, or open it as an email you send yourself. NextChapter sends nothing. */
export function AskPartner({ text, name }: { text: string; name: string }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <CopyButton text={text} label={`Copy the ask for ${name}`} />
      <a href={`mailto:?subject=${encodeURIComponent('A funding application we would like you in on')}&body=${encodeURIComponent(text)}`} className="text-xs font-medium text-primary hover:underline">
        Email it
      </a>
    </span>
  )
}
