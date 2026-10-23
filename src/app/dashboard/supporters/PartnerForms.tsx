'use client'

import Link from 'next/link'
import { useActionState, useState, useTransition } from 'react'
import { usePostHog } from '@/lib/posthog/client'
import { endPartnershipAction, invitePartnerAction, updateSharingAction } from '@/app/dashboard/move-plan/actions'

const field = 'h-11 w-full rounded-xl border border-border bg-white px-3.5 text-base text-ink'
const choice = (on: boolean) => `inline-flex items-center rounded-lg border px-4 py-2 text-sm font-semibold ${on ? 'border-ink bg-ink text-white' : 'border-border text-ink hover:bg-muted'}`

function ShareChoice({ legend, why, value, onChange }: { legend: string; why: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-4 first:border-t-0">
      <legend className="sr-only">{legend}</legend>
      <div className="max-w-xl">
        <p className="text-base font-semibold text-ink">{legend}</p>
        <p className="text-sm text-muted-foreground">Why: {why}</p>
      </div>
      <div className="flex gap-2" role="group" aria-label={legend}>
        <button type="button" aria-pressed={value} onClick={() => onChange(true)} className={choice(value)}>Share</button>
        <button type="button" aria-pressed={!value} onClick={() => onChange(false)} className={choice(!value)}>Don’t share</button>
      </div>
    </fieldset>
  )
}

export function InvitePartnerForm() {
  const posthog = usePostHog()
  const [places, setPlaces] = useState(true)
  const [pay, setPay] = useState(true)
  const [state, action, pending] = useActionState(async (prev: { ok?: boolean; error?: string } | null, fd: FormData) => {
    const r = await invitePartnerAction(prev, fd)
    if (r?.ok) posthog?.capture('partner_invite_submitted', { source: 'supporters_page', sharePlaces: places, shareJobsPay: pay })
    return r
  }, null)
  return (
    <form action={action} className={pending ? 'cursor-wait space-y-4' : 'space-y-4'}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="partner-name" className="block text-base font-semibold text-ink">Their name</label>
          <input id="partner-name" name="name" required autoComplete="off" className={field} />
        </div>
        <div className="space-y-2">
          <label htmlFor="partner-email" className="block text-base font-semibold text-ink">Their email</label>
          <input id="partner-email" name="email" type="email" required autoComplete="off" className={field} />
        </div>
      </div>
      <div className="rounded-2xl border border-border px-4">
        <ShareChoice legend="The places you are comparing" why="so you can weigh them together. They can add places too." value={places} onChange={setPlaces} />
        <ShareChoice legend="Your pay in those places" why="so they can see what your work pays where you would live." value={pay} onChange={setPay} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border py-4">
          <div className="max-w-xl"><p className="text-base font-semibold text-ink">Your applications, contacts, notes and messages</p><p className="text-sm text-muted-foreground">Why: a search is private. This is never shared with a partner.</p></div>
          <span className="text-sm font-semibold text-ink">Always private</span>
        </div>
      </div>
      <input type="hidden" name="sharePlaces" value={places ? 'yes' : 'no'} />
      <input type="hidden" name="shareJobsPay" value={pay ? 'yes' : 'no'} />
      <button type="submit" disabled={pending} className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95 disabled:cursor-wait disabled:opacity-70">
        {pending ? 'Sending invite…' : 'Send the invite'}
      </button>
      {state?.ok && <p role="status" className="text-base text-ink">Invite sent. You can change what they see or remove them at any time.</p>}
      {state?.error && <p role="alert" className="text-base text-destructive">{state.error}</p>}
    </form>
  )
}

export function PartnerCard({ role, linkId, name, joined, sharePlaces, shareJobsPay }: { role: 'owner' | 'partner'; linkId: string; name: string; joined: boolean; sharePlaces: boolean; shareJobsPay: boolean }) {
  const [places, setPlaces] = useState(sharePlaces)
  const [pay, setPay] = useState(shareJobsPay)
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const save = (p: boolean, y: boolean) => start(() => updateSharingAction(linkId, p, y))
  return (
    <div className="space-y-4 rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-ink">{name}{' '}<span className="rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium text-muted-foreground">{joined ? 'Joined' : 'Invited'}</span></p>
          <p className="text-sm text-muted-foreground">
            {role === 'owner'
              ? joined ? `Sees the places you are comparing${pay ? ' and your pay there' : ''}.` : 'Waiting for them to accept.'
              : `You are searching alongside ${name}. They never see your applications, contacts or messages.`}
          </p>
        </div>
        {joined && <Link href="/dashboard/move-plan" className="inline-flex h-11 items-center rounded-full bg-action px-7 text-base font-semibold text-action-foreground hover:brightness-95">Open your move plan</Link>}
      </div>
      {role === 'owner' && (
        <div className="rounded-2xl border border-border px-4" aria-busy={pending}>
          <ShareChoice legend="The places you are comparing" why="so you can weigh them together." value={places} onChange={(v) => { setPlaces(v); save(v, pay) }} />
          <ShareChoice legend="Your pay in those places" why="so they can see what your work pays where you would live." value={pay} onChange={(v) => { setPay(v); save(places, v) }} />
        </div>
      )}
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground">
          {role === 'owner' ? 'Remove partner' : 'Leave this search'}
        </button>
      ) : (
        <span className="flex flex-wrap items-center gap-3 text-sm">
          <span>{role === 'owner' ? `Stop sharing with ${name}?` : 'Stop searching together?'}</span>
          <button type="button" onClick={() => setConfirming(false)} className="font-medium underline underline-offset-4">Keep it</button>
          <button type="button" disabled={pending} onClick={() => start(() => endPartnershipAction(linkId))} className="font-medium text-destructive underline underline-offset-4 disabled:cursor-wait">{pending ? 'Ending…' : 'Yes, end it'}</button>
        </span>
      )}
    </div>
  )
}
