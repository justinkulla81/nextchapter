'use client'

import { useActionState, useState, useTransition } from 'react'
import { posthog } from '@/lib/posthog/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { makeCode, saveSchedulingUrl, setSessionsLeft, turnOffCode } from '@/app/support/coach/(app)/access/actions'

function Note({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (state?.error) return <p className="text-sm text-destructive">{state.error}</p>
  if (state?.ok) return <p className="text-sm text-brand">{state.ok}</p>
  return null
}

export function SchedulingUrlForm({ current }: { current: string | null }) {
  const [state, action] = useActionState(saveSchedulingUrl, undefined)
  return (
    <form action={action} className="space-y-2">
      <Label htmlFor="schedulingUrl">Your booking link (Calendly, Google, Microsoft or similar)</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="schedulingUrl" name="schedulingUrl" type="url" defaultValue={current ?? ''} placeholder="https://calendly.com/you" />
        <SubmitButton pendingLabel="Saving…">Save link</SubmitButton>
      </div>
      <Note state={state} />
    </form>
  )
}

export function MakeCodeForm() {
  const [state, action] = useActionState(makeCode, undefined)
  const [copied, setCopied] = useState(false)
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="sessions">Sessions</Label>
          <Input id="sessions" name="sessions" type="number" min={1} max={100} defaultValue={state?.error ? undefined : 4} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="validDays">Good for (days)</Label>
          <Input id="validDays" name="validDays" type="number" min={1} max={730} placeholder="No end" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="maxUses">How many people can use it</Label>
          <Input id="maxUses" name="maxUses" type="number" min={1} max={500} defaultValue={1} />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="note">Note to yourself (optional)</Label>
        <Input id="note" name="note" maxLength={200} placeholder="Paid by invoice 1042" />
      </div>
      <SubmitButton pendingLabel="Making code…">Make a code</SubmitButton>
      <Note state={state} />
      {state?.code && (
        <div className="flex items-center gap-3 rounded-md border border-border bg-muted px-3 py-2">
          <code className="text-base font-semibold tracking-wider">{state.code}</code>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(state.code!).then(() => setCopied(true))
              posthog.capture('coach_access_code_copied')
            }}
          >
            {copied ? 'Copied' : 'Copy code'}
          </Button>
        </div>
      )}
    </form>
  )
}

export function TurnOffCodeButton({ codeId }: { codeId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const [err, setErr] = useState<string | null>(null)
  if (!confirming) return <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>Turn off</Button>
  return (
    <span className="flex items-center gap-2" style={pending ? { cursor: 'wait' } : undefined}>
      <span className="text-xs text-muted-foreground">No one new can use it. Sessions already given stay.</span>
      <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => start(async () => { const r = await turnOffCode(codeId); if (r.error) setErr(r.error) })}>
        {pending ? 'Turning off…' : 'Turn off code'}
      </Button>
      <Button type="button" variant="ghost" size="sm" autoFocus onClick={() => setConfirming(false)}>Keep it</Button>
      {err && <span className="text-xs text-destructive">{err}</span>}
    </span>
  )
}

export function SessionsLeftForm({ candidateId, left }: { candidateId: string; left: number | null }) {
  const [state, action] = useActionState(setSessionsLeft, undefined)
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="candidateId" value={candidateId} />
      <div className="space-y-1">
        <Label htmlFor={`left-${candidateId}`} className="text-xs">Sessions you give, left</Label>
        <Input id={`left-${candidateId}`} name="sessionsLeft" type="number" min={0} max={200} defaultValue={left ?? ''} className="w-24" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`days-${candidateId}`} className="text-xs">For (days)</Label>
        <Input id={`days-${candidateId}`} name="validDays" type="number" min={1} max={730} placeholder="No end" className="w-24" />
      </div>
      <SubmitButton size="sm" pendingLabel="Saving…">Save</SubmitButton>
      <Note state={state} />
    </form>
  )
}
