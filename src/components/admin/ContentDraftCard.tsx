'use client'

import { useState, useTransition } from 'react'
import posthog from 'posthog-js'
import { Button } from '@/components/ui/button'
import { CopyButton } from '@/components/ui/copy-button'
import { Textarea } from '@/components/ui/textarea'
import { markPosted, reopenDraft, skipDraft } from '@/app/support/admin/(portal)/content-drafts/actions'
import { CHANNELS, CHANNEL_LABEL, copyText, type Channel, type Versions } from '@/lib/content/card'

export interface ContentDraftData {
  id: string
  kindLabel: string
  headline: string
  big: string
  bigLabel: string
  status: string
  source: string
  versions: Versions
  posts: { channel: string; url: string; whenLabel: string }[]
  /** Distinct visitors in the last 30 days, by utm_source, for this draft's campaign. */
  visits: Record<string, number>
}

export function ContentDraftCard({ d }: { d: ContentDraftData }) {
  const [channel, setChannel] = useState<Channel>('linkedin')
  const [text, setText] = useState<Record<Channel, string>>(() => Object.fromEntries(CHANNELS.map((c) => [c, copyText(d.versions, c)])) as Record<Channel, string>)
  const [url, setUrl] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ message: string }>, after?: () => void) => start(async () => { setNote((await fn()).message); after?.() })
  const done = (c: string) => d.posts.some((p) => p.channel === c)
  const img = (size: 'portrait' | 'wide', download = false) => `/api/admin/content-drafts/${d.id}/image?size=${size}${download ? '&download=1' : ''}`
  const track = (action: string, extra?: Record<string, unknown>) => posthog.capture('content_draft_action', { draftId: d.id, action, channel, ...extra })
  const totalVisits = Object.values(d.visits).reduce((a, b) => a + b, 0)

  return (
    <article className="grid gap-3 border-b border-border py-3 md:grid-cols-[1fr_220px]" style={{ cursor: pending ? 'wait' : undefined }}>
      <div className="space-y-2">
        <header>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {d.kindLabel} · {d.status === 'POSTED' ? 'posted' : d.status === 'SKIPPED' ? 'skipped' : 'draft'} · {d.source}
          </p>
          <h2 className="text-base font-semibold"><span className="mr-2 tabular-nums">{d.big}</span>{d.headline}</h2>
          <p className="text-sm text-muted-foreground">{d.bigLabel}{totalVisits ? ` · ${totalVisits} visitors in 30 days (${Object.entries(d.visits).map(([s, n]) => `${s} ${n}`).join(', ')})` : ''}</p>
        </header>

        <div role="tablist" className="flex flex-wrap gap-1">
          {CHANNELS.map((c) => (
            <Button key={c} type="button" size="sm" variant={c === channel ? 'default' : 'outline'} role="tab" aria-selected={c === channel} onClick={() => setChannel(c)}>
              {CHANNEL_LABEL[c]}{done(c) ? ' ✓' : ''}
            </Button>
          ))}
        </div>

        <Textarea aria-label={`${CHANNEL_LABEL[channel]} text`} value={text[channel]} onChange={(e) => setText({ ...text, [channel]: e.target.value })} rows={channel === 'video' ? 12 : 9} className="font-mono text-sm" />
        {channel === 'linkedin' ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">First comment (the link):</span>
            <CopyButton text={d.versions.linkedin.comment} onCopy={() => track('copy_linkedin_comment')} />
          </div>
        ) : null}
        {channel === 'reddit' ? (
          <p className="text-sm text-muted-foreground">
            Fits: {d.versions.reddit.subreddits.map((s) => `r/${s}`).join(', ')}. Read the sub&apos;s rules first; the last line is the only link, so delete it where links are banned.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <CopyButton text={text[channel]} onCopy={() => track('copy')} label={`Copy ${CHANNEL_LABEL[channel]} text`} />
          <input
            type="url" inputMode="url" placeholder={`Paste the ${CHANNEL_LABEL[channel]} post address`} aria-label="Address of the live post"
            value={url} onChange={(e) => setUrl(e.target.value)} className="h-8 min-w-60 flex-1 rounded-md border border-border bg-background px-2 text-sm"
          />
          <Button type="button" size="sm" disabled={pending || !url.trim()} onClick={() => run(() => markPosted(d.id, channel, url), () => { track('mark_posted'); setUrl('') })}>
            Mark posted on {CHANNEL_LABEL[channel]}
          </Button>
          {d.status === 'SKIPPED' ? (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => reopenDraft(d.id))}>Reopen</Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => skipDraft(d.id), () => track('skip'))}>Skip</Button>
          )}
        </div>
        {note ? <p role="status" className="text-sm">{note}</p> : null}
        {d.posts.length ? (
          <ul className="text-sm text-muted-foreground">
            {d.posts.map((p) => (
              <li key={p.url}>{CHANNEL_LABEL[p.channel as Channel] ?? p.channel} · {p.whenLabel} · <a href={p.url} target="_blank" rel="noreferrer" className="underline">{p.url}</a></li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="space-y-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img('portrait')} alt={`Image card: ${d.big} ${d.bigLabel}`} width={220} height={275} className="w-full rounded-md border border-border" loading="lazy" />
        <div className="flex gap-2 text-sm">
          <a className="underline" href={img('portrait', true)} download onClick={() => track('image_download', { size: 'portrait' })}>1080×1350</a>
          <a className="underline" href={img('wide', true)} download onClick={() => track('image_download', { size: 'wide' })}>1200×630</a>
        </div>
      </div>
    </article>
  )
}
