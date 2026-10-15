import type { SuppressedSenderReason } from '@prisma/client'

// Kept apart from suppressed-senders.ts (server-only) so the picker can show
// the same options the server action validates against.
export const SUPPRESSED_SENDER_REASONS: {
  reason: SuppressedSenderReason
  label: string
  hint: string
  // Spam and newsletters come from a sender's whole domain; a family member
  // or friend is one person (a shared gmail.com must never be blocked).
  scope: 'address' | 'domain'
}[] = [
  { reason: 'FAMILY_FRIENDS', label: 'Family or friend', hint: 'Personal, not part of my search', scope: 'address' },
  { reason: 'SCHOOL_ACTIVITIES', label: 'School or activities', hint: "Kids' school, clubs, sports, community", scope: 'domain' },
  { reason: 'SPAM_BULK', label: 'Spam or newsletter', hint: 'Marketing, promotions, automated mail', scope: 'domain' },
  { reason: 'NOT_WORK', label: 'Not work-related', hint: 'Something else that is not about jobs', scope: 'address' },
]
