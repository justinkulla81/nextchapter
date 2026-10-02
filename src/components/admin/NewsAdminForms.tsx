'use client'

import { useActionState, useState } from 'react'
import posthog from 'posthog-js'
import { SubmitButton } from '@/components/ui/submit-button'
import { addLink, runNewsDiscoveryNow, updateNewsItem } from '@/app/support/admin/(portal)/digest/actions'
import { NEWS_TAGS } from '@/lib/news/tags'
import { COMPANY_LINKEDIN_URL } from '@/lib/contact/constants'

const INPUT = 'mt-1 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand'

function TagCheckboxes({ idPrefix, selected = [] }: { idPrefix: string; selected?: string[] }) {
  return (
    <fieldset>
      <legend className="text-sm text-muted-foreground">Topics (any that apply)</legend>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
        {NEWS_TAGS.map((t) => (
          <label key={t.key} htmlFor={`${idPrefix}-${t.key}`} className="flex items-center gap-1.5 text-sm">
            <input id={`${idPrefix}-${t.key}`} type="checkbox" name="tags" value={t.key}
              defaultChecked={selected.includes(t.key)} className="size-3.5" />
            {t.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Copies a caption and opens the company page, where it is pasted into a
 * new post.
 *
 * LinkedIn only lets an approved app post as a company page, so this is the
 * hand-off that works without one: the text is on the clipboard and the
 * page is open.
 */
export function LinkedInShareButton({ itemId, caption, compact = false }: { itemId: string; caption: string; compact?: boolean }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  async function share() {
    posthog.capture('news_linkedin_share_clicked', { itemId })
    try {
      await navigator.clipboard.writeText(caption)
      setState('copied')
    } catch {
      setState('failed')
    }
    window.open(`${COMPANY_LINKEDIN_URL}admin/page-posts/published/?share=true`, '_blank', 'noopener')
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={share}
        className={compact ? 'text-sm text-primary underline underline-offset-4' : 'rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted'}>
        Post to the LinkedIn page
      </button>
      {state === 'copied' && <span role="status" className="text-xs text-muted-foreground">Caption copied — paste it into the new post.</span>}
      {state === 'failed' && <span role="status" className="text-xs text-muted-foreground">Could not copy — copy the link from the list.</span>}
    </span>
  )
}

const DIGEST_AUDIENCES = [
  { value: 'CANDIDATE', label: 'Candidates' },
  { value: 'COACH', label: 'Coaches' },
  { value: 'RECRUITER', label: 'Recruiters' },
  { value: 'EMPLOYER', label: 'Employers' },
]

/**
 * The one box for adding a link. Where it goes is chosen here: the homepage
 * (on by default — it is the usual reason to add one), the Tuesday email
 * digest, both, or just the Market Pulse table.
 */
export function AddLinkForm() {
  const [state, formAction] = useActionState(addLink, undefined)
  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Add a link</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          An article, a YouTube or Vimeo video, a Spotify or Apple podcast, or a LinkedIn or Instagram post. It is saved to
          Market Pulse; the choices below decide where else it goes.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="add-url" className="text-sm text-muted-foreground">Link</label>
          <input id="add-url" name="url" type="url" required placeholder="https://…" className={`${INPUT} h-9`} />
        </div>
        <SubmitButton pendingLabel="Adding…" savedLabel="Done">Add link</SubmitButton>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Homepage</legend>
          <label htmlFor="add-homepage" className="flex items-center gap-1.5 text-sm">
            <input id="add-homepage" type="checkbox" name="homepage" defaultChecked className="size-3.5" />
            Show in News on the homepage and the News page
          </label>
          <TagCheckboxes idPrefix="new" />
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Tuesday email digest</legend>
          <p className="mt-1 text-sm text-muted-foreground">
            Tick who should get it. It goes out by itself on the next Tuesday morning, one article per email.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {DIGEST_AUDIENCES.map((a) => (
              <label key={a.value} htmlFor={`add-aud-${a.value}`} className="flex items-center gap-1.5 text-sm">
                <input id={`add-aud-${a.value}`} type="checkbox" name="audiences" value={a.value} className="size-3.5" />
                {a.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.message && <p role="status" className="text-sm text-primary">{state.message}</p>}
      {state?.share && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          <span>Post this to the NextChapter LinkedIn page too?</span>
          <LinkedInShareButton itemId={state.share.itemId} caption={state.share.caption} />
        </div>
      )}
    </form>
  )
}

export function EditNewsItemForm({ item }: {
  item: { id: string; kind: string; title: string | null; blurb: string | null; imageUrl: string | null; source: string | null; tags: string[]; take: string | null }
}) {
  const [state, formAction] = useActionState(updateNewsItem, undefined)
  const isPost = item.kind === 'instagram' || item.kind === 'linkedin'
  const host = item.kind === 'instagram' ? 'Instagram' : 'LinkedIn'
  return (
    <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="id" value={item.id} />
      {isPost ? (
        <p className="text-sm text-muted-foreground sm:col-span-2">
          With a picture or a caption, this shows as a card like the others: picture on top, then the caption. With neither,
          it shows through {host}&apos;s own embed.
        </p>
      ) : (
        <div className="sm:col-span-2">
          <label htmlFor={`title-${item.id}`} className="text-sm text-muted-foreground">Headline</label>
          <input id={`title-${item.id}`} name="title" defaultValue={item.title ?? ''} maxLength={200} className={`${INPUT} h-9`} />
        </div>
      )}
      <div className="sm:col-span-2">
        <label htmlFor={`blurb-${item.id}`} className="text-sm text-muted-foreground">
          {isPost ? 'Caption (the post’s own words)' : 'Summary (one or two sentences)'}
        </label>
        <textarea id={`blurb-${item.id}`} name="blurb" defaultValue={item.blurb ?? ''} rows={isPost ? 4 : 2} maxLength={isPost ? 600 : 400} className={`${INPUT} py-2`} />
      </div>
      <div>
        <label htmlFor={`image-${item.id}`} className="text-sm text-muted-foreground">Picture link (https)</label>
        <input id={`image-${item.id}`} name="imageUrl" type="url" defaultValue={item.imageUrl ?? ''} className={`${INPUT} h-9`} />
      </div>
      <div>
        <label htmlFor={`source-${item.id}`} className="text-sm text-muted-foreground">{isPost ? 'Posted by' : 'Source'}</label>
        <input id={`source-${item.id}`} name="source" defaultValue={item.source ?? ''} maxLength={80} className={`${INPUT} h-9`} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={`take-${item.id}`} className="text-sm text-muted-foreground">Our take (optional)</label>
        <p className="text-xs text-muted-foreground">
          Your own paragraph or two on why this matters to someone searching for a job. Saving one gives the item its own
          page on the site, which is what search engines can rank; the card then links there first.
        </p>
        <textarea id={`take-${item.id}`} name="take" defaultValue={item.take ?? ''} rows={4} maxLength={4000} className={`${INPUT} py-2`} />
      </div>
      <div className="sm:col-span-2">
        <TagCheckboxes idPrefix={`edit-${item.id}`} selected={item.tags} />
      </div>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        {state?.message && <p role="status" className="text-sm text-primary">{state.message}</p>}
      </div>
    </form>
  )
}

/**
 * Every link on one line each, on the clipboard.
 *
 * NotebookLM has no way for another program to add sources, but its
 * "Website" source box takes a pasted list — so this is the whole hand-off.
 */
export function CopyLinksButton({ urls, label }: { urls: string[]; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')
  async function copy() {
    posthog.capture('news_links_copied', { count: urls.length })
    try {
      await navigator.clipboard.writeText(urls.join('\n'))
      setState('copied')
    } catch {
      setState('failed')
    }
  }
  if (urls.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" onClick={copy} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
        {label}
      </button>
      {state === 'copied' && (
        <span role="status" className="text-xs text-muted-foreground">
          {urls.length} {urls.length === 1 ? 'link' : 'links'} copied — in NotebookLM choose Add source, Website, and paste.
        </span>
      )}
      {state === 'failed' && <span role="status" className="text-xs text-destructive">Your browser blocked the copy. Try again.</span>}
    </span>
  )
}

export function FindArticlesForm({ topics }: { topics: string[] }) {
  const [state, formAction] = useActionState(runNewsDiscoveryNow, undefined)
  return (
    <form action={formAction} className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Topic search</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Every morning Market Pulse searches the news for {topics.length} topics and adds up to three new links each to the table below.
          </p>
        </div>
        <SubmitButton variant="outline" pendingLabel="Searching…" savedLabel="Done">Find new articles now</SubmitButton>
      </div>
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show the topics</summary>
        <p className="mt-1 text-muted-foreground">{topics.join(' · ')}</p>
      </details>
      {state?.message && <p role="status" className="mt-2 text-sm text-primary">{state.message}</p>}
    </form>
  )
}
