'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from '@/lib/posthog/client'
import { PERSONALIZE_HREF } from '@/components/home/PersonalizePanel'
import { startNetworkJoinAction } from '@/lib/community/network-actions'
import type { NetworkKind } from '@/lib/community/network-copy'

/**
 * The button of the page's one ask (NextStepBox) on a role, function or industry page. These pages are public and cached for
 * everyone, and they sit on a different host from the member app, so they cannot tell a member from a visitor. Every click does
 * the same thing: remember the network, then send the person into the member app, where signing in or creating an account
 * finishes the join (PendingNetworkJoin).
 */
export function NetworkJoinButton({ networkKey, kind, name, onBusy }: { networkKey: string; kind: NetworkKind; name: string; onBusy?: (busy: boolean) => void }) {
  const posthog = usePostHog()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function join() {
    setError(null)
    onBusy?.(true)
    posthog?.capture('network_join_clicked', { networkKind: kind, networkKey, source: `page:${networkKey}` })
    startTransition(async () => {
      const result = await startNetworkJoinAction(networkKey).catch(() => null)
      if (!result) {
        onBusy?.(false)
        return setError('Something went wrong on our end. Your click was not lost: try again in a moment.')
      }
      if (!result.ok) {
        onBusy?.(false)
        return setError(result.error)
      }
      router.push(PERSONALIZE_HREF)
    })
  }

  return (
    <div className="flex shrink-0 flex-col items-stretch sm:items-end">
      <button
        type="button"
        onClick={join}
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center rounded-full bg-action px-6 py-3 text-center text-base font-semibold leading-tight text-action-foreground hover:brightness-95 disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? `Joining the ${name} network…` : `Join the ${name} network`}
      </button>
      <p className="mt-2 text-xs text-white/85 sm:text-right">Free. You will sign in or create an account first, then you are added.</p>
      {error && (
        <p role="alert" className="mt-2 rounded-lg bg-white/15 px-3 py-2 text-sm text-white">
          {error}
        </p>
      )}
    </div>
  )
}
