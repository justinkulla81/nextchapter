'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { postToLinkedInAction, enableConfidentialLinkedInPosting } from '@/app/dashboard/marketing-plan/actions'

// Posts the given text as a real LinkedIn feed update via the UGC Posts API
// (see src/lib/linkedin/oauth.ts) — the only thing the w_member_social scope
// actually allows (LinkedIn has no API to directly rewrite a profile's
// About/Headline fields, only to publish a new status update). Used
// wherever a candidate has genuinely post-worthy text — draft feed posts
// (ThoughtLeadershipStudio), not profile-field suggestions like the
// LinkedIn About/Headline cards in WaysToSayIt.
export function PostToLinkedInButton({
  text,
  connected,
  blockedByConfidentialMode,
}: {
  text: string
  connected: boolean
  blockedByConfidentialMode: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<'idle' | 'posted' | 'error'>('idle')
  const [enabledJustNow, setEnabledJustNow] = useState(false)

  if (!connected) {
    return (
      <a
        href="/api/auth/linkedin/start"
        className={cn(
          'inline-flex h-8 items-center rounded-md border border-input bg-white px-3 text-sm font-medium text-foreground transition-colors hover:border-brand/40'
        )}
      >
        Connect LinkedIn to post
      </a>
    )
  }

  // §4.3: "LinkedIn posting disabled by default, with the reason stated" —
  // and "if they enable posting deliberately, warn once: your current
  // employer can see this." Re-checked server-side in postToLinkedInAction
  // regardless of enabledJustNow.
  if (blockedByConfidentialMode && !enabledJustNow) {
    return (
      <div className={cn('flex flex-col gap-1.5', isPending && 'cursor-progress [&_*]:cursor-progress')}>
        <p className="text-xs text-muted-foreground">
          Posting is off while Confidential Search Mode is on.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => {
            startTransition(async () => {
              await enableConfidentialLinkedInPosting()
              setEnabledJustNow(true)
            })
          }}
        >
          {isPending ? 'Enabling…' : 'Enable anyway — your current employer can see this'}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        // Green once there's real text to post — a visible cue that the
        // button is actually ready to fire, not just decoration.
        variant={text.trim() ? 'success' : 'outline'}
        disabled={isPending || !text.trim()}
        className={isPending ? 'cursor-wait' : ''}
        onClick={() => {
          startTransition(async () => {
            const ok = await postToLinkedInAction(text)
            setResult(ok ? 'posted' : 'error')
            setTimeout(() => setResult('idle'), 3000)
          })
        }}
      >
        {isPending ? 'Posting…' : 'Post to LinkedIn'}
      </Button>
      {result === 'posted' && <span className="text-xs font-medium text-success">Posted!</span>}
      {result === 'error' && <span className="text-xs font-medium text-destructive">Couldn&apos;t post — try again</span>}
    </div>
  )
}
