'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { setContactEmploymentStatus } from '@/app/dashboard/companies/[slug]/actions'
import { cn } from '@/lib/utils'

export function ContactEmploymentStatusButtons({ contactId, companyPageId }: { contactId: string; companyPageId: string }) {
  const [isPending, startTransition] = useTransition()
  return (
    <div className={cn('flex shrink-0 gap-1.5', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => startTransition(() => setContactEmploymentStatus(contactId, 'CURRENT', companyPageId))}
      >
        Still there?
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={isPending}
        onClick={() => startTransition(() => setContactEmploymentStatus(contactId, 'FORMER', companyPageId))}
      >
        They left
      </Button>
    </div>
  )
}
