'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/ui/copy-button'
import { ConfirmActionButton } from './ConfirmActionButton'
import { answerReferral, closeReferral, sendReferral, type ReferralResult } from '@/app/i/[slug]/(portal)/referral-actions'

function Note({ state }: { state: ReferralResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>
  if (state?.ok && state.message) return <p role="status" className="text-sm text-muted-foreground">{state.message}</p>
  return null
}

export function SendReferralForm({ slug, partners, cohorts, offerings }: { slug: string; partners: { id: string; name: string }[]; cohorts: { id: string; name: string }[]; offerings: { id: string; title: string }[] }) {
  const [state, action] = useActionState<ReferralResult, FormData>(sendReferral.bind(null, slug), undefined)
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="r-partner">Partner</Label>
          <select id="r-partner" name="partnerId" required defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
            <option value="" disabled>Choose a partner</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="space-y-1"><Label htmlFor="r-due">Needed by (optional)</Label><Input id="r-due" name="dueDate" type="date" /></div>
        <div className="space-y-1 sm:col-span-2"><Label htmlFor="r-title">What you are asking</Label><Input id="r-title" name="title" required maxLength={160} placeholder="Take about 40 operations managers into the Lean Six Sigma cohort" /></div>
        <div className="space-y-1">
          <Label htmlFor="r-cohort">The group it is about (optional)</Label>
          <select id="r-cohort" name="cohortId" defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
            <option value="">None</option>
            {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="r-offering">The training it is about (optional)</Label>
          <select id="r-offering" name="offeringId" defaultValue="" className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm">
            <option value="">None</option>
            {offerings.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="r-message">A note (optional)</Label>
          <textarea id="r-message" name="message" maxLength={1200} rows={3} className="w-full rounded-md border border-border bg-background p-2 text-sm" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">A referral is about a need, never a person: if you pick a group, the partner sees a rounded count, and nothing under five.</p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Sending…">Send the referral</SubmitButton>
        <Note state={state} />
      </div>
    </form>
  )
}

export function AnswerReferralForm({ slug, id }: { slug: string; id: string }) {
  const [state, action] = useActionState<ReferralResult, FormData>(answerReferral.bind(null, slug, id), undefined)
  return (
    <form action={action} className="space-y-2">
      <Label htmlFor={`ans-${id}`}>Your answer (required if you decline)</Label>
      <textarea id={`ans-${id}`} name="note" maxLength={600} rows={2} className="w-full rounded-md border border-border bg-background p-2 text-sm" placeholder="We can take 30 seats starting Jan 12." />
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" name="decision" value="ACCEPTED" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">Accept</button>
        <button type="submit" name="decision" value="DECLINED" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted">Decline</button>
        <Note state={state} />
      </div>
    </form>
  )
}

export function CloseReferralButtons({ slug, id, canDone, canWithdraw, title }: { slug: string; id: string; canDone: boolean; canWithdraw: boolean; title: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {canDone && <ConfirmActionButton label="Mark done" confirm={`Mark “${title}” as done?`} confirmLabel="Yes, mark done" run={() => closeReferral(slug, id, 'DONE')} />}
      {canWithdraw && <ConfirmActionButton label="Withdraw" confirm="Withdraw this referral? The partner will see it as withdrawn." confirmLabel="Yes, withdraw it" variant="outline" run={() => closeReferral(slug, id, 'WITHDRAWN')} />}
    </div>
  )
}

export function CopyReferral({ text, name }: { text: string; name: string }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <CopyButton text={text} label={`Copy the message for ${name}`} />
      <a href={`mailto:?subject=${encodeURIComponent('A referral for you in the Partner Hub')}&body=${encodeURIComponent(text)}`} className="text-xs font-medium text-primary hover:underline">
        Email it
      </a>
    </span>
  )
}
