'use client'

import { useActionState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  completeMentorRequest,
  optInAsMentor,
  pauseMentoring,
  requestMentorCall,
  respondToMentorRequest,
  type MentorFormState,
} from '@/app/i/[slug]/(portal)/mentor-actions'

export function MentorOptInForm({ slug, industries, functions, maxCalls, active }: { slug: string; industries: string; functions: string; maxCalls: number; active: boolean }) {
  const [state, formAction, pending] = useActionState<MentorFormState, FormData>(optInAsMentor.bind(null, slug), null)
  const [pausing, startPause] = useTransition()
  return (
    <form action={formAction} className={cn('space-y-4', (pending || pausing) && 'cursor-wait [&_*]:cursor-wait')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="mentor-industries">Industries you can speak to</Label>
          <Input id="mentor-industries" name="industries" defaultValue={industries} placeholder="Health care, energy" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mentor-functions">Functions you can speak to</Label>
          <Input id="mentor-functions" name="functions" defaultValue={functions} placeholder="Finance, operations" />
        </div>
      </div>
      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="mentor-max">Calls you can take a month</Label>
        <Input id="mentor-max" name="maxCallsPerMonth" type="number" min={1} max={8} defaultValue={maxCalls} />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p className="text-sm text-foreground">Saved. Fellow alumni can now request a call.</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : active ? 'Update my mentor profile' : 'Offer to take calls'}
        </Button>
        {active && (
          <Button type="button" variant="ghost" disabled={pausing} onClick={() => startPause(async () => { await pauseMentoring(slug) })}>
            {pausing ? 'Pausing…' : 'Pause mentoring'}
          </Button>
        )}
      </div>
    </form>
  )
}

export function RequestCallForm({ slug, mentorId, name }: { slug: string; mentorId: string; name: string }) {
  const [state, formAction, pending] = useActionState<MentorFormState, FormData>(requestMentorCall.bind(null, slug, mentorId), null)
  if (state?.ok) return <p className="text-sm text-foreground">Request sent to {name}. They will respond within the portal.</p>
  return (
    <form action={formAction} className={cn('space-y-2', pending && 'cursor-wait [&_*]:cursor-wait')}>
      <Label htmlFor={`note-${mentorId}`} className="sr-only">
        What would you like to ask {name}?
      </Label>
      <Textarea id={`note-${mentorId}`} name="note" rows={2} placeholder="A line on what you would like to ask (optional)" />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? 'Sending…' : `Request a call with ${name}`}
      </Button>
    </form>
  )
}

export function RequestActions({ slug, requestId, status }: { slug: string; requestId: string; status: string }) {
  const [pending, start] = useTransition()
  if (status === 'REQUESTED') {
    return (
      <div className={cn('flex gap-2', pending && 'cursor-wait [&_*]:cursor-wait')}>
        <Button size="sm" disabled={pending} onClick={() => start(async () => { await respondToMentorRequest(slug, requestId, 'ACCEPTED') })}>
          Accept
        </Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(async () => { await respondToMentorRequest(slug, requestId, 'DECLINED') })}>
          Decline
        </Button>
      </div>
    )
  }
  if (status === 'ACCEPTED') {
    return (
      <Button size="sm" disabled={pending} onClick={() => start(async () => { await completeMentorRequest(slug, requestId) })}>
        {pending ? 'Saving…' : 'Mark the call complete'}
      </Button>
    )
  }
  return null
}
