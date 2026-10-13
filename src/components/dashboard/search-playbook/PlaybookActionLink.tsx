'use client'

import Link from 'next/link'
import { posthog } from '@/lib/posthog/client'

export function PlaybookActionLink({
  href,
  children,
  journey,
  atWeek,
}: {
  href: string
  children: React.ReactNode
  journey: string
  atWeek: number
}) {
  return (
    <Link
      href={href}
      className="text-primary underline underline-offset-4"
      onClick={() => posthog.capture('search_playbook_action_clicked', { journey, milestoneWeek: atWeek, href })}
    >
      {children}
    </Link>
  )
}
