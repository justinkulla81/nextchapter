'use client'

import { useActionState } from 'react'
import { SubmitButton } from '@/components/ui/submit-button'
import { addNewsItem, updateNewsItem } from '@/app/support/admin/(portal)/digest/actions'

const INPUT = 'mt-1 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand'

export function AddNewsItemForm() {
  const [state, formAction] = useActionState(addNewsItem, undefined)
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <label htmlFor="news-url" className="text-sm text-muted-foreground">
          Link to an article, a YouTube or Vimeo video, or an Instagram post
        </label>
        <input id="news-url" name="url" type="url" required placeholder="https://…" className={`${INPUT} h-9`} />
      </div>
      <SubmitButton pendingLabel="Fetching preview…" savedLabel="Done">Add to News</SubmitButton>
      {state?.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
      {state?.message && <p role="status" className="w-full text-sm text-primary">{state.message}</p>}
    </form>
  )
}

export function EditNewsItemForm({ item }: {
  item: { id: string; kind: string; title: string | null; blurb: string | null; imageUrl: string | null; source: string | null }
}) {
  const [state, formAction] = useActionState(updateNewsItem, undefined)
  const instagram = item.kind === 'instagram'
  return (
    <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={item.id} />
      {instagram ? (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Instagram draws this post itself, picture and caption included, so there is nothing to edit here.
        </p>
      ) : (
        <>
          <div className="sm:col-span-2">
            <label htmlFor={`title-${item.id}`} className="text-sm text-muted-foreground">Headline</label>
            <input id={`title-${item.id}`} name="title" defaultValue={item.title ?? ''} maxLength={200} className={`${INPUT} h-9`} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`blurb-${item.id}`} className="text-sm text-muted-foreground">Summary (one or two sentences)</label>
            <textarea id={`blurb-${item.id}`} name="blurb" defaultValue={item.blurb ?? ''} rows={2} maxLength={400} className={`${INPUT} py-2`} />
          </div>
          <div>
            <label htmlFor={`image-${item.id}`} className="text-sm text-muted-foreground">Picture link (https)</label>
            <input id={`image-${item.id}`} name="imageUrl" type="url" defaultValue={item.imageUrl ?? ''} className={`${INPUT} h-9`} />
          </div>
          <div>
            <label htmlFor={`source-${item.id}`} className="text-sm text-muted-foreground">Source</label>
            <input id={`source-${item.id}`} name="source" defaultValue={item.source ?? ''} maxLength={80} className={`${INPUT} h-9`} />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
            {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
            {state?.message && <p role="status" className="text-sm text-primary">{state.message}</p>}
          </div>
        </>
      )}
    </form>
  )
}
