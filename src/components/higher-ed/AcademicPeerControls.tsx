'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmActionButton } from '@/components/higher-ed/ConfirmActionButton'
import { addPeer, removePeer, resetPeers } from '@/app/i/[slug]/(portal)/academic-actions'
import { cn } from '@/lib/utils'

type Result = { error?: string; message?: string } | undefined

/** Add a college to the peer group: a search box over every college that awards four-year degrees. */
export function AddPeerForm({ slug, names }: { slug: string; names: string[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(addPeer.bind(null, slug), undefined)
  return (
    <form action={action} className={cn('flex flex-wrap items-end gap-2', pending && 'cursor-wait')}>
      <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">Add a college to your peer group</span>
        <input name="college" list="peer-colleges" autoComplete="off" required placeholder="Start typing a college name" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
      </label>
      <datalist id="peer-colleges">{names.map((n) => <option key={n} value={n} />)}</datalist>
      <Button type="submit" disabled={pending}>{pending ? 'Adding…' : 'Add college'}</Button>
      {state?.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
      {state?.message && <p role="status" className="w-full text-sm text-muted-foreground">{state.message}</p>}
    </form>
  )
}

export function RemovePeerButton({ slug, unitid, name }: { slug: string; unitid: string; name: string }) {
  return <ConfirmActionButton label="Remove" confirm={`Remove ${name} from your peer group?`} confirmLabel="Remove" variant="outline" run={() => removePeer(slug, unitid)} />
}

export function ResetPeersButton({ slug }: { slug: string }) {
  return <ConfirmActionButton label="Use suggested peers" confirm="Replace your chosen colleges with the suggested peers? You can choose again at any time." confirmLabel="Use suggested peers" variant="outline" run={() => resetPeers(slug)} />
}
