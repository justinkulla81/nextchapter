'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePostHog } from '@/lib/posthog/client'
import { PERSONALIZE_HREF } from '@/components/home/PersonalizePanel'
import { joinNetworkAction, networkStatusAction } from '@/lib/community/network-actions'
import { networkCopy, type NetworkKind } from '@/lib/community/network-copy'
import { cn } from '@/lib/utils'

export type NetworkBandStatus = 'unknown' | 'signed_out' | 'can_join' | 'joined' | 'confidential'

/**
 * The join block under the intro of a role, function or industry page. The page is cached for everyone, so whether the
 * viewer is signed in or already a member is read after load; until then it shows the join button, which also works for
 * a signed-out visitor (it carries them through signup).
 */
export function NetworkBand({ networkKey, kind, name, spelled }: { networkKey: string; kind: NetworkKind; name: string; spelled: string }) {
  const posthog = usePostHog()
  const router = useRouter()
  const [status, setStatus] = useState<NetworkBandStatus>('unknown')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let live = true
    networkStatusAction(networkKey)
      .then((s) => live && setStatus(s))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [networkKey])

  function join() {
    setError(null)
    posthog?.capture('network_join_clicked', { networkKind: kind, networkKey, source: `page:${networkKey}`, signedIn: status !== 'signed_out' && status !== 'unknown' })
    startTransition(async () => {
      const result = await joinNetworkAction(networkKey).catch(() => null)
      if (!result) return setError('Something went wrong on our end. Your click was not lost: try again in a moment.')
      if (result.status === 'error') return setError(result.error)
      if (result.status === 'signed_out') return router.push(PERSONALIZE_HREF)
      setStatus('joined')
    })
  }

  return <NetworkBandView status={status} kind={kind} name={name} spelled={spelled} pending={pending} error={error} onJoin={join} />
}

/** The band itself, with no data access, so the preview page can render every state. */
export function NetworkBandView({
  status,
  kind,
  name,
  spelled,
  pending = false,
  error = null,
  onJoin,
}: {
  status: NetworkBandStatus
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
      <h2 id="peer-network" className="text-xl font-semibold tracking-tight">
        {status === 'joined' ? `You are in the ${name} network` : copy.headline}
      </h2>

      {status === 'joined' ? (
        <>
          <p className="mt-2 max-w-2xl text-sm text-white/90">
            You will get a weekly email with what is open for {copy.scope} and what other members posted. The feed itself opens once you have earned your first milestone.
          </p>
          <Link href="/dashboard/community" className="mt-4 inline-flex items-center rounded-lg bg-action px-5 py-3 text-sm font-semibold text-action-foreground hover:brightness-95">
            Open the {name} network
          </Link>
        </>
      ) : status === 'confidential' ? (
        <p className="mt-2 max-w-2xl text-sm text-white/90">
          Networks are off while Confidential Search Mode is on, because joining one makes you visible to its members. Turn the mode off in your privacy settings to join the {name} network.
        </p>
      ) : (
        <>
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
          {status === 'signed_out' || status === 'unknown' ? (
            <p className="mt-2 text-xs text-white/85">Free. You will create an account first, then you are added.</p>
          ) : null}
          {error && (
            <p role="alert" className="mt-3 max-w-2xl rounded-lg bg-white/15 px-3 py-2 text-sm text-white">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  )
}
