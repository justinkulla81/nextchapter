'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { createSampleDraft, disconnectLinkedIn } from '@/app/support/admin/(portal)/linkedin-drafts/actions'

const FLASH: Record<string, string> = {
  connected: 'NextChapter page connected.',
  needs_product: 'LinkedIn would not let this app post as a company page. The LinkedIn app needs the Community Management API product (LinkedIn developer portal, your app, Products), which LinkedIn approves. Until then, copy and paste each post as the page.',
  no_page: 'You are signed in to LinkedIn, but that account is not an administrator of a company page. Sign in with the account that administers NextChapter.',
  which_page: 'That account administers more than one page and none is named NextChapter. Tell me which one to use.',
  denied: 'LinkedIn sign-in was cancelled. Nothing changed.',
  exchange_failed: 'LinkedIn connected but did not hand over a usable token. Try again; if it repeats, the LinkedIn app may be missing the "Share on LinkedIn" product.',
  not_configured: 'LinkedIn is not set up on the server yet.',
}

export function LinkedInConnectionBar({ connectedAs, personalOnly, expiresLabel, flash }: { connectedAs: string | null; personalOnly: boolean; expiresLabel: string | null; flash: string | null }) {
  const [note, setNote] = useState<string | null>(flash ? FLASH[flash] ?? null : null)
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ message: string }>) => start(async () => setNote((await fn()).message))

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3" style={{ cursor: pending ? 'wait' : undefined }}>
      <p className="text-sm">
        {connectedAs
          ? <>Posting as <strong>{connectedAs}</strong>, public{expiresLabel ? `, connected until ${expiresLabel}` : ''}.</>
          : personalOnly
            ? 'LinkedIn is connected as you, but posts must come from the NextChapter page. Connect the page to post from here; otherwise copy and paste.'
            : 'The NextChapter page is not connected. Connect it to post a draft from here as NextChapter; otherwise copy and paste.'}
      </p>
      {connectedAs
        ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(disconnectLinkedIn)}>Disconnect</Button>
        : <Button nativeButton={false} size="sm" render={<a href="/api/admin/linkedin/start" />}>Connect the NextChapter page</Button>}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(createSampleDraft)}>Make a sample draft</Button>
      {note ? <span role="status" className="text-sm text-muted-foreground">{note}</span> : null}
    </section>
  )
}
