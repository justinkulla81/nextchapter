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

/**
 * The email topics a member can switch on or off individually, each tied to the
 * one opt-out flag that actually gates those emails. A checked box means the
 * member receives them (the flag is the inverse).
 */
export const EMAIL_TOPICS = [
  {
    field: 'weeklyReportOptedOut',
    label: 'Monday plan and connection alerts',
    description: 'Your plan for the week, "a way in" at companies you applied to, and a note if you have been away.',
  },
  {
    field: 'marketDigestOptedOut',
    label: 'Weekly market update',
    description: 'Tuesday: hiring and market conditions for your target role.',
  },
  {
    field: 'dailyEmailOptedOut',
    label: 'Thursday check-in and Sunday week-in-review',
    description: 'Where you stand against this week’s goal, and how the week went.',
  },
  {
    field: 'jobSearchDailyOptedOut',
    label: 'Job Search Daily',
    description: 'New roles that fit you and follow-ups that are due, when there is something worth sending.',
  },
] as const

export type EmailTopicField = (typeof EMAIL_TOPICS)[number]['field']
