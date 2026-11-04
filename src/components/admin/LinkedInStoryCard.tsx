'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Textarea } from '@/components/ui/textarea'
import { approveStoryDraft, postStoryNow, saveStoryDraft, skipStoryDraft, unapproveStoryDraft } from '@/app/support/admin/(portal)/linkedin-drafts/actions'

export interface StoryCardData {
  id: string
  topicLabel: string
  approved: boolean
  body: string
  firstComment: string
  /** Pre-formatted in Eastern time on the server. */
  slotLabel: string
  /** The slot has come: an approved story posts at the next hourly run. */
  due: boolean
  /** The numbers and statements the post was written from, so each figure can be checked. */
  factLines: string[]
  tags: { name: string; note: string }[]
  /** LinkedIn is connected as the page, so a story can be posted from here. */
  canPost: boolean
}

export function LinkedInStoryCard({ d }: { d: StoryCardData }) {
  const [body, setBody] = useState(d.body)
  const [comment, setComment] = useState(d.firstComment)
  const [note, setNote] = useState<string | null>(null)
  const [postUrl, setPostUrl] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ message: string }>) => start(async () => setNote((await fn()).message))
  const post = () => start(async () => {
    setConfirming(false)
    const r = await postStoryNow(d.id)
    setNote(r.message)
    setPostUrl(r.url ?? null)
  })
  const edited = body !== d.body || comment !== d.firstComment

  return (
    <article className="grid gap-4 rounded-lg border border-border p-4 md:grid-cols-[1fr_320px]" style={{ cursor: pending ? 'wait' : undefined }}>
      <div className="space-y-3">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">{d.topicLabel}</h2>
          <p className="text-sm text-muted-foreground">
            {d.approved
              ? <><strong className="text-foreground">Approved</strong>: {d.due ? 'posts at the next hourly run' : <>posts at <strong className="text-foreground">{d.slotLabel}</strong></>}</>
              : <>Needs your approval to post at <strong className="text-foreground">{d.slotLabel}</strong></>}
          </p>
        </header>

        <label className="block text-sm font-medium" htmlFor={`story-body-${d.id}`}>Post</label>
        <Textarea id={`story-body-${d.id}`} value={body} onChange={(e) => setBody(e.target.value)} rows={14} />
        <label className="block text-sm font-medium" htmlFor={`story-comment-${d.id}`}>First comment (the link goes here, not in the post)</label>
        <Textarea id={`story-comment-${d.id}`} value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />

        <div className="flex flex-wrap items-center gap-2">
          {!d.approved ? (
            <Button size="sm" disabled={pending || edited} onClick={() => run(() => approveStoryDraft(d.id))}>Approve</Button>
          ) : (
            <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => unapproveStoryDraft(d.id))}>Take back approval</Button>
          )}
          {edited ? <span className="text-xs text-muted-foreground">Save your edits before approving, so the approved text is the saved text.</span> : null}
          <Button size="sm" variant="outline" disabled={pending || !edited} onClick={() => run(() => saveStoryDraft(d.id, body, comment))}>Save edits</Button>
          {d.canPost && !confirming ? <Button size="sm" variant="outline" disabled={pending || edited} onClick={() => setConfirming(true)}>Post now</Button> : null}
          {confirming ? (
            <span className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-sm">
              Posts as NextChapter, publicly and now, with the first comment.
              <Button size="sm" disabled={pending} onClick={() => post()}>Post publicly</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
            </span>
          ) : null}
          <CopyButton text={body} label="Copy post text" />
          <CopyButton text={comment} label="Copy first comment" />
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => skipStoryDraft(d.id))}>Skip</Button>
          {note ? <span role="status" className="text-sm text-muted-foreground">{note}</span> : null}
          {postUrl ? <a href={postUrl} target="_blank" rel="noreferrer" className="text-sm underline">Open the post</a> : null}
        </div>
        {!d.canPost ? <p className="text-xs text-muted-foreground">Connect the NextChapter page (above) before an approved story can post.</p> : null}
      </div>

      <aside className="space-y-3 text-sm">
        <div className="space-y-1">
          <p className="font-medium">Facts it was written from</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            {d.factLines.map((l) => <li key={l}>{l}</li>)}
          </ul>
        </div>
        {d.tags.length ? (
          <div className="space-y-1">
            <p className="font-medium">Tag these when you post</p>
            <ul className="space-y-1 text-muted-foreground">
              {d.tags.map((t) => <li key={t.name}>{t.name}: {t.note}</li>)}
            </ul>
          </div>
        ) : null}
        <div className="space-y-1">
          <p className="font-medium">In the first hour after posting</p>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Answer every comment; replies count as engagement.</li>
            <li>Comment on the post from your own profile with a useful detail.</li>
          </ul>
        </div>
      </aside>
    </article>
  )
}
