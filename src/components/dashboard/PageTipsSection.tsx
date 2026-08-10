'use client'

import { useTransition } from 'react'
import { reenableWhyItMattersBox } from '@/app/dashboard/actions'
import type { PageKey } from '@/lib/dashboard/page-content'
import { Button } from '@/components/ui/button'

const PAGE_LABELS: Partial<Record<PageKey, string>> = {
  dashboard: 'Success Dashboard',
  network: 'Network with My Contacts',
  'find-my-job': 'Find My Job',
  resume: 'Resume',
  'interview-prep': 'Interview Prep',
  'marketing-plan': 'My Marketing Plan',
  learning: 'Learning',
  linkedin: 'LinkedIn',
  'interim-work': 'Interim Work',
  'work-samples': 'Work Samples',
  community: 'Support Network',
  profile: 'Profile',
  privacy: 'Privacy',
  portfolio: 'My Portfolio',
  references: 'My References',
}

export function PageTipsSection({ dismissed }: { dismissed: { pageKey: string; dismissedAt: Date }[] }) {
  const [pending, startTransition] = useTransition()

  if (dismissed.length === 0) {
    return <p className="text-sm text-muted-foreground">You haven&apos;t dismissed any page tips.</p>
  }

  return (
    <ul className="space-y-2">
      {dismissed.map((d) => (
        <li key={d.pageKey} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <span className="text-sm text-foreground">{PAGE_LABELS[d.pageKey as PageKey] ?? d.pageKey}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(() => reenableWhyItMattersBox(d.pageKey as PageKey))}
          >
            Show again
          </Button>
        </li>
      ))}
    </ul>
  )
}
