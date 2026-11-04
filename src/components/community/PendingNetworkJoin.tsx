'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { applyPendingNetworkJoinAction } from '@/lib/community/network-actions'
import { LEGACY_PENDING_ROLE_COOKIE, PENDING_NETWORK_COOKIE } from '@/lib/community/network-cookie'

/**
 * Finishes a join the visitor started on a role, function or industry page before they had an account. Renders nothing
 * unless the cookie is there; then it joins once and says so, so the membership never appears without them being told.
 */
export function PendingNetworkJoin() {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    const has = (name: string) => document.cookie.split('; ').some((c) => c.startsWith(`${name}=`))
    if (!has(PENDING_NETWORK_COOKIE) && !has(LEGACY_PENDING_ROLE_COOKIE)) return
    applyPendingNetworkJoinAction()
      .then((r) => setLabel(r.joinedLabel))
      .catch(() => {})
  }, [])

  if (!label) return null
  return (
    <div role="status" className="mx-auto mt-4 max-w-3xl rounded-xl border border-border bg-white px-4 py-3 text-sm text-ink lg:ml-72">
      You have been added to the {label}. <Link href="/dashboard/community" className="text-brand underline underline-offset-4">See your networks</Link>
    </div>
  )
}
