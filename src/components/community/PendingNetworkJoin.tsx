'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { applyPendingNetworkJoinAction, type ApplyNetworkJoinResult } from '@/lib/community/network-actions'
import { LEGACY_PENDING_ROLE_COOKIE, PENDING_NETWORK_COOKIE } from '@/lib/community/network-cookie'

/**
 * Finishes a join the visitor started on a role, function or industry page. Renders nothing unless the cookie is there; then
 * it joins once and says what happened, so a membership never appears without them being told and a refusal (Confidential
 * Search Mode) is never silent. Mounted in onboarding and the dashboard: a new member is sent to onboarding first.
 */
export function PendingNetworkJoin({ className = '' }: { className?: string }) {
  const [result, setResult] = useState<ApplyNetworkJoinResult | null>(null)

  useEffect(() => {
    const has = (name: string) => document.cookie.split('; ').some((c) => c.startsWith(`${name}=`))
    if (!has(PENDING_NETWORK_COOKIE) && !has(LEGACY_PENDING_ROLE_COOKIE)) return
    applyPendingNetworkJoinAction()
      .then(setResult)
      .catch(() => {})
  }, [])

  if (!result || (!result.joinedLabel && !result.error)) return null
  return (
    <div role="status" className={`mx-auto mt-4 max-w-3xl rounded-xl border border-border bg-white px-4 py-3 text-sm text-ink ${className}`}>
      {result.joinedLabel ? (
        <>
          You have been added to the {result.joinedLabel}.{' '}
          <Link href="/dashboard/community" className="text-brand underline underline-offset-4">See your networks</Link>
        </>
      ) : (
        result.error
      )}
    </div>
  )
}
