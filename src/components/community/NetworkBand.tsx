'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { usePostHog } from '@/lib/posthog/client'
import { PERSONALIZE_HREF } from '@/components/home/PersonalizePanel'
import { startNetworkJoinAction } from '@/lib/community/network-actions'
import { networkCopy, type NetworkKind } from '@/lib/community/network-copy'
import { cn } from '@/lib/utils'

/**
 * The join block under the intro of a role, function or industry page. These pages are public and cached for everyone, and
 * they sit on a different host from the member app, so they cannot tell a member from a visitor. Every click therefore does
 * the same thing: remember the network, then send the person into the member app, where signing in or creating an account
 * finishes the join (PendingNetworkJoin).
 */
export function NetworkBand({ networkKey, kind, name, spelled }: { networkKey: string; kind: NetworkKind; name: string; spelled: string }) {
  const posthog = usePostHog()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function join() {
    setError(null)
    posthog?.capture('network_join_clicked', { networkKind: kind, networkKey, source: `page:${networkKey}` })
    startTransition(async () => {
      const result = await startNetworkJoinAction(networkKey).catch(() => null)
      if (!result) return setError('Something went wrong on our end. Your click was not lost: try again in a moment.')
      if (!result.ok) return setError(result.error)
      router.push(PERSONALIZE_HREF)
    })
  }

  return <NetworkBandView kind={kind} name={name} spelled={spelled} pending={pending} error={error} onJoin={join} />
}

/** The band itself, with no data access, so the preview page can render it. */
export function NetworkBandView({
  kind,
  name,
  spelled,
  pending = false,
  error = null,
  onJoin,
}: {
  kind: NetworkKind
  name: string
  spelled: string
  pending?: boolean
  error?: string | null
  onJoin: () => void
}) {
  const copy = networkCopy(kind, name, spelled)
  return (
    <section className={cn('mt-6 rounded-3xl bg-gradient-to-br from-brand to-light-blue p-6 text-white sm:p-8', pending && 'cursor-wait')} aria-labelledby="peer-network">
      <h2 id="peer-network" className="text-xl font-semibold tracking-tight">{copy.headline}</h2>
      <p className="mt-2 max-w-2xl text-sm text-white/90">{copy.intro}</p>
      <ul className="mt-2 max-w-2xl list-disc space-y-1 pl-5 text-sm text-white/90">
        {copy.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onJoin}
        disabled={pending}
        className="mt-4 inline-flex items-center rounded-lg bg-action px-5 py-3 text-sm font-semibold text-action-foreground hover:brightness-95 disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? `Joining the ${name} network…` : `Join the ${name} network`}
      </button>
      <p className="mt-2 text-xs text-white/85">Free. You will sign in or create an account first, then you are added.</p>
      {error && (
        <p role="alert" className="mt-3 max-w-2xl rounded-lg bg-white/15 px-3 py-2 text-sm text-white">
          {error}
        </p>
      )}
    </section>
  )
}
