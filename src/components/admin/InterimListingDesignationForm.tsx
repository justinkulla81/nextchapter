'use client'

import { updateInterimListingDesignation } from '@/app/support/admin/(portal)/interim-listings/actions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { InterimListingDesignation } from '@prisma/client'

const LABELS: Record<string, string> = {
  PARTNER: 'Partner',
  INCLUDED_FOR_QUALITY: 'Included for quality',
}

export function InterimListingDesignationForm({
  listingId,
  designation,
}: {
  listingId: string
  designation: InterimListingDesignation
}) {
  return (
    <Select
      defaultValue={designation}
      onValueChange={(value) => {
        if (!value) return
        void updateInterimListingDesignation(listingId, value as InterimListingDesignation)
      }}
    >
      <SelectTrigger className="h-8 w-[180px] text-xs">
        <SelectValue>{(v: string | null) => (v ? LABELS[v] : undefined)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="PARTNER">Partner</SelectItem>
        <SelectItem value="INCLUDED_FOR_QUALITY">Included for quality</SelectItem>
      </SelectContent>
    </Select>
  )
}
