'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmActionButton } from './ConfirmActionButton'
import { createGroup, deleteGroup, postUpdate, saveMembers, type GroupResult } from '@/app/i/[slug]/(portal)/groups-actions'

function Note({ state }: { state: GroupResult }) {
  if (state?.error) return <p role="alert" className="text-sm text-destructive">{state.error}</p>
  if (state?.ok && state.message) return <p role="status" className="text-sm text-muted-foreground">{state.message}</p>
  return null
}

export function NewGroupForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<GroupResult, FormData>(createGroup.bind(null, slug), undefined)
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label htmlFor="g-name">Name of the group</Label><Input id="g-name" name="name" required maxLength={80} placeholder="Workforce coordination council" /></div>
        <div className="space-y-1"><Label htmlFor="g-purpose">What it is for (optional)</Label><Input id="g-purpose" name="purpose" maxLength={300} placeholder="Meets monthly to line up funding and referrals" /></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Starting…">Start the group</SubmitButton>
        <Note state={state} />
      </div>
    </form>
  )
}

export function MembersForm({ slug, groupId, partners, chosen }: { slug: string; groupId: string; partners: { id: string; name: string; kind: string }[]; chosen: string[] }) {
  const [state, action] = useActionState<GroupResult, FormData>(saveMembers.bind(null, slug, groupId), undefined)
  const on = new Set(chosen)
  return (
    <form action={action} className="space-y-3">
      <div className="grid max-h-64 gap-1 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2">
        {partners.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="partnerId" value={p.id} defaultChecked={on.has(p.id)} className="size-4" />
            {p.name} <span className="text-xs text-muted-foreground">{p.kind}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save members</SubmitButton>
        <Note state={state} />
      </div>
    </form>
  )
}

export function PostForm({ slug, groupId }: { slug: string; groupId: string }) {
  const [state, action] = useActionState<GroupResult, FormData>(postUpdate.bind(null, slug, groupId), undefined)
  return (
    <form action={action} className="space-y-2">
      <Label htmlFor={`post-${groupId}`}>Post an update to the group</Label>
      <textarea id={`post-${groupId}`} name="body" required maxLength={1500} rows={3} className="w-full rounded-md border border-border bg-background p-2 text-sm" placeholder="Next meeting Dec 9. The Reserve Fund application is due Dec 2: please confirm your match." />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Posting…">Post the update</SubmitButton>
        <Note state={state} />
      </div>
    </form>
  )
}

export function DeleteGroupButton({ slug, groupId, name }: { slug: string; groupId: string; name: string }) {
  return <ConfirmActionButton label="Delete the group" confirm={`Delete “${name}” and its updates? Its partners are not affected.`} confirmLabel="Yes, delete it" variant="outline" run={() => deleteGroup(slug, groupId)} />
}
