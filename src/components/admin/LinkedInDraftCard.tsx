'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Textarea } from '@/components/ui/textarea'
import { markPosted, postDraftToLinkedIn, saveDraft, skipDraft } from '@/app/support/admin/(portal)/linkedin-drafts/actions'

export interface DraftCardData {
  id: string
  employer: string
  employees: number
  place: string | null
  credibilityLabel: string
  sourceUrl: string | null
  angle: string
  body: string
  firstComment: string
  /** Pre-formatted in Eastern time on the server. */
  slotLabel: string
  due: boolean
  rewritten: boolean
  tags: { name: string; note: string; linkedinUrl: string | null }[]
  /** LinkedIn is connected, so the draft can be posted from here. */
  canPost: boolean
}

export function LinkedInDraftCard({ d }: { d: DraftCardData }) {
  const [body, setBody] = useState(d.body)
  const [comment, setComment] = useState(d.firstComment)
  const [note, setNote] = useState<string | null>(null)
  const [postUrl, setPostUrl] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ message: string }>) => start(async () => setNote((await fn()).message))
  const post = (visibility: 'PUBLIC' | 'CONNECTIONS') => start(async () => {
    setConfirming(false)
    const r = await postDraftToLinkedIn(d.id, visibility)
    setNote(r.message)
    setPostUrl(r.url ?? null)
  })
  const imageUrl = `/api/admin/linkedin-drafts/${d.id}/image`

  return (
    <article className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-[1fr_340px]" style={{ cursor: pending ? 'wait' : undefined }}>
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">
            {d.employer} · {d.employees.toLocaleString('en-US')} jobs{d.place ? ` · ${d.place}` : ''}
          </h2>
          <p className="text-sm text-muted-foreground">
            {d.due ? <strong className="text-foreground">Post now</strong> : <>Post at <strong className="text-foreground">{d.slotLabel}</strong></>}
            {' · '}{d.credibilityLabel}{' · '}angle: {d.angle}{d.rewritten ? ' · rewritten' : ' · template wording'}
            {d.sourceUrl ? <> · <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="underline">source</a></> : null}
          </p>
        </header>

        <label className="block text-sm font-medium" htmlFor={`body-${d.id}`}>Post</label>
        <Textarea id={`body-${d.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={12} />
        <label className="block text-sm font-medium" htmlFor={`comment-${d.id}`}>First comment (the link goes here, not in the post)</label>
        <Textarea id={`comment-${d.id}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />

        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={body} label="Copy post text" />
          <span className="text-xs text-muted-foreground">post</span>
          <CopyButton text={comment} label="Copy first comment" />
          <span className="text-xs text-muted-foreground">comment</span>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => saveDraft(d.id, body, comment))}>Save edits</Button>
          {d.canPost && !confirming ? <Button size="sm" disabled={pending} onClick={() => setConfirming(true)}>Post to LinkedIn</Button> : null}
          {confirming ? (
            <span className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm">
              Posts as you, now, with the image and the first comment.
              <Button size="sm" disabled={pending} onClick={() => post('PUBLIC')}>Post publicly</Button>
              <Button size="sm" variant="outline" disabled={pending} onClick={() => post('CONNECTIONS')}>Connections only</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </span>
          ) : null}
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => markPosted(d.id))}>Mark as posted</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => skipDraft(d.id))}>Skip</Button>
          {note ? <span role="status" className="text-sm text-muted-foreground">{note}</span> : null}
          {postUrl ? <a href={postUrl} target="_blank" rel="noreferrer" className="text-sm underline">Open the post</a> : null}
        </div>
      </div>

      <aside className="space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={`Card for ${d.employer}`} className="w-full rounded-lg border border-border" />
        <Button nativeButton={false} size="sm" variant="outline" render={<a href={`${imageUrl}?download=1`} />}>Download image</Button>
        <div className="space-y-1 text-sm">
          <p className="font-medium">Tag these when you post</p>
          <ul className="space-y-1 text-muted-foreground">
            <li>{d.employer} company page (type @ and pick it)</li>
            {d.tags.map((t) => (
              <li key={t.name}>
                {t.linkedinUrl ? <a href={t.linkedinUrl} target="_blank" rel="noreferrer" className="underline">{t.name}</a> : t.name}: {t.note}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </article>
  )
}
