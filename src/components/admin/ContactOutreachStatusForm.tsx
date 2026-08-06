'use client'

import { updateContactOutreachStatus } from '@/app/support/admin/(portal)/network-leads/actions'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ContactAdminOutreachStatus } from '@prisma/client'

const OPTIONS: { value: ContactAdminOutreachStatus; label: string }[] = [
  { value: 'NOT_REVIEWED', label: 'Not reviewed' },
  { value: 'TO_CONTACT', label: 'To contact' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'NOT_INTERESTED', label: 'Not interested' },
]

export function ContactOutreachStatusForm({
  contactId,
  status,
}: {
  contactId: string
  status: ContactAdminOutreachStatus
}) {
  return (
    <Select
      defaultValue={status}
      onValueChange={(value) => {
        if (!value) return
        void updateContactOutreachStatus(contactId, value as ContactAdminOutreachStatus)
      }}
    >
      <SelectTrigger className="h-8 w-[140px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
