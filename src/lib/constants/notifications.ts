import type { NotificationTier } from '@prisma/client'

export const NOTIFICATION_TIERS: Array<{
  value: NotificationTier
  label: string
  description: string
  preview: string
  recommended?: boolean
}> = [
  {
    value: 'FULL',
    label: 'Full',
    description:
      'Daily nudge every day, a Friday check-in on your weekly progress, and a weekly Community & Coaching digest — plus your Hireability Report and any reminder emails.',
    preview: 'Everything, as it happens',
    recommended: true,
  },
  {
    value: 'ESSENTIALS',
    label: 'Essentials',
    description:
      'Daily nudge twice a week (Monday and Thursday) instead of every day — still includes the Friday check-in and weekly digest.',
    preview: 'Twice a week, not every day',
  },
  {
    value: 'MINIMAL',
    label: 'Minimal',
    description:
      "No recurring nudge, no Friday check-in, no weekly digest — you'll still get your Hireability Report and any reminder emails.",
    preview: 'Just the essentials, no recurring nudges',
  },
]
