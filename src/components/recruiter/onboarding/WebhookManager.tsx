'use client'

import { useActionState, useState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CopyButton } from '@/components/ui/copy-button'
import { FIRM_WEBHOOK_EVENT_LABELS, FIRM_WEBHOOK_EVENTS } from '@/lib/recruiter/webhook-shared'
import {
  deleteWebhook,
  rotateWebhookSecret,
  saveWebhook,
  setWebhookActive,
  testWebhook,
  type OnboardingFormState,
} from '@/app/recruiters/(app)/talent/onboarding/actions'

export interface WebhookRow {
  id: string
  url: string
  events: string[]
  isActive: boolean
  lastSuccessAt: string | null
  lastFailureAt: string | null
  deliveries: { id: string; event: string; status: string; responseStatus: number | null; error: string | null; createdAt: string }[]
}

function Secret({ secret }: { secret: string }) {
  return (
    <div className="space-y-1 rounded-md border border-orange/40 bg-orange/5 p-3">
      <p className="text-sm font-medium">Your signing secret</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 text-xs">{secret}</code>
        <CopyButton text={secret} />
      </div>
      <p className="text-xs text-muted-foreground">Shown once. Use it to check the NextChapter-Signature header on each delivery.</p>
    </div>
  )
}

function EndpointCard({ ep }: { ep: WebhookRow }) {
  const [testState, test, testing] = useActionState<OnboardingFormState>(testWebhook.bind(null, ep.id), undefined)
  const [rotState, rotate, rotating] = useActionState<OnboardingFormState>(rotateWebhookSecret.bind(null, ep.id), undefined)
  const [confirmDelete, setConfirmDelete] = useState(false)
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <code className="min-w-0 break-all text-sm">{ep.url}</code>
        <span className={ep.isActive ? 'text-xs font-semibold text-success' : 'text-xs font-semibold text-muted-foreground'}>{ep.isActive ? 'On' : 'Paused'}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Sends: {ep.events.map((e) => FIRM_WEBHOOK_EVENT_LABELS[e as keyof typeof FIRM_WEBHOOK_EVENT_LABELS] ?? e).join('; ')}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <form action={test} className={testing ? 'cursor-progress' : undefined}><SubmitButton size="sm" variant="outline" pendingLabel="Sending…">Send a test</SubmitButton></form>
        <form action={rotate} className={rotating ? 'cursor-progress' : undefined}><SubmitButton size="sm" variant="outline" pendingLabel="Creating…">New secret</SubmitButton></form>
        <form action={setWebhookActive.bind(null, ep.id, !ep.isActive)}><SubmitButton size="sm" variant="outline" pendingLabel="…">{ep.isActive ? 'Pause' : 'Turn on'}</SubmitButton></form>
        {confirmDelete ? (
          <form action={deleteWebhook.bind(null, ep.id)} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Remove this endpoint?</span>
            <SubmitButton size="sm" variant="destructive" pendingLabel="Removing…">Yes, remove</SubmitButton>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
          </form>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>Remove</Button>
        )}
      </div>
      {testState?.error && <p role="alert" className="text-sm text-destructive">{testState.error}</p>}
      {testState?.success && <p className="text-sm text-success">{testState.success}</p>}
      {rotState?.error && <p role="alert" className="text-sm text-destructive">{rotState.error}</p>}
      {rotState?.secret && <Secret secret={rotState.secret} />}
      {ep.deliveries.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">Recent deliveries ({ep.deliveries.length})</summary>
          <ul className="mt-2 space-y-1">
            {ep.deliveries.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 text-xs">
                <span className={d.status === 'SUCCESS' ? 'text-success' : d.status === 'FAILED' ? 'text-destructive' : 'text-muted-foreground'}>
                  {d.status === 'SUCCESS' ? 'Delivered' : d.status === 'FAILED' ? 'Failed' : 'Sending'}
                </span>
                <span>{d.event}</span>
                <span className="text-muted-foreground">{new Date(d.createdAt).toLocaleString('en-US')}</span>
                {d.error && <span className="text-muted-foreground">{d.error}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function WebhookManager({ endpoints }: { endpoints: WebhookRow[] }) {
  const [state, action, pending] = useActionState(saveWebhook, undefined)
  return (
    <div className="space-y-4">
      {endpoints.map((ep) => <EndpointCard key={ep.id} ep={ep} />)}
      <form action={action} className={pending ? 'space-y-3 cursor-progress' : 'space-y-3'}>
        <div className="space-y-2">
          <Label htmlFor="whurl">Where should we send it?</Label>
          <Input id="whurl" name="url" placeholder="https://hooks.example.com/nextchapter" inputMode="url" required />
          <p className="text-xs text-muted-foreground">Works with Zapier, Make, your ATS or CRM, or your own server. Must start with https://.</p>
        </div>
        <fieldset className="space-y-1">
          <legend className="mb-1 text-sm font-medium">Tell me when</legend>
          {FIRM_WEBHOOK_EVENTS.map((e) => (
            <label key={e} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={`ev_${e}`} defaultChecked /> {FIRM_WEBHOOK_EVENT_LABELS[e]}
            </label>
          ))}
        </fieldset>
        {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        {state?.success && <p className="text-sm text-success">{state.success}</p>}
        {state?.secret && <Secret secret={state.secret} />}
        <SubmitButton pendingLabel="Adding…">Add endpoint</SubmitButton>
      </form>
    </div>
  )
}
