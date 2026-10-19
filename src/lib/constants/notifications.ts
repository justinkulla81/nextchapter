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
      'Your Monday plan, a Tuesday market update, a Thursday check-in on where you stand, a Sunday week-in-review, and a daily job email whenever there is something new — plus your Market Reality Report and any reminder emails.',
    preview: 'Everything, as it happens',
    recommended: true,
  },
  {
    value: 'ESSENTIALS',
    label: 'Essentials',
    description:
      'Two emails a week (Monday plan, Thursday check-in), plus a job email only when something is urgent — and your Market Reality Report and any reminder emails.',
    preview: 'Twice a week, not every day',
  },
  {
    value: 'MINIMAL',
    label: 'Minimal',
    description:
      "No recurring emails — you'll still get your Market Reality Report and any reminder emails.",
    preview: 'Just the essentials, no recurring nudges',
  },
]
