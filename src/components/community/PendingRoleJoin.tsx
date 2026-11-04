'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { applyPendingRoleJoinAction } from '@/app/roles/network-actions'
import { PENDING_ROLE_COOKIE } from '@/lib/community/role-network-cookie'

/**
 * Finishes a join the visitor started on a role page before they had an account. Renders nothing unless the cookie
 * is there; then it joins once and says so, so the membership never appears without them being told.
 */
export function PendingRoleJoin() {
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    if (!document.cookie.split('; ').some((c) => c.startsWith(`${PENDING_ROLE_COOKIE}=`))) return
    applyPendingRoleJoinAction()
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
