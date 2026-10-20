'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { createSampleDraft, disconnectLinkedIn } from '@/app/support/admin/(portal)/linkedin-drafts/actions'

const FLASH: Record<string, string> = {
  connected: 'LinkedIn connected.',
  denied: 'LinkedIn sign-in was cancelled. Nothing changed.',
  exchange_failed: 'LinkedIn connected but did not hand over a usable token. Try again; if it repeats, the LinkedIn app may be missing the "Share on LinkedIn" product.',
  not_configured: 'LinkedIn is not set up on the server yet.',
}

export function LinkedInConnectionBar({ connectedAs, expiresLabel, flash }: { connectedAs: string | null; expiresLabel: string | null; flash: string | null }) {
  const [note, setNote] = useState<string | null>(flash ? FLASH[flash] ?? null : null)
  const [pending, start] = useTransition()
  const run = (fn: () => Promise<{ message: string }>) => start(async () => setNote((await fn()).message))

  return (
    <section className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3" style={{ cursor: pending ? 'wait' : undefined }}>
      <p className="text-sm">
        {connectedAs
          ? <>LinkedIn connected as <strong>{connectedAs}</strong>{expiresLabel ? ` until ${expiresLabel}` : ''}. Posts go out as you.</>
          : 'LinkedIn is not connected. Connect it to post a draft from here; otherwise copy and paste.'}
      </p>
      {connectedAs
        ? <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(disconnectLinkedIn)}>Disconnect</Button>
        : <Button nativeButton={false} size="sm" render={<a href="/api/admin/linkedin/start" />}>Connect LinkedIn</Button>}
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(createSampleDraft)}>Make a sample draft</Button>
      {note ? <span role="status" className="text-sm text-muted-foreground">{note}</span> : null}
    </section>
  )
}
