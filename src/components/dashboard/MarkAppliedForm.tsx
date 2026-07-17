'use client'

import { SubmitButton } from '@/components/ui/submit-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { APPLICATION_CHANNEL_LABELS } from '@/lib/jobs/conversion-diagnostic'

export function MarkAppliedForm({
  jobPostingId,
  markApplied,
}: {
  jobPostingId: string
  markApplied: (jobPostingId: string, formData: FormData) => Promise<void>
}) {
  return (
    <form action={markApplied.bind(null, jobPostingId)} className="flex items-center gap-2">
      <Select name="channel" defaultValue="COLD_APPLICATION">
        <SelectTrigger size="sm" aria-label="How did you apply?">
          <SelectValue placeholder="How did you apply?">
            {(value: string | null) =>
              value
                ? APPLICATION_CHANNEL_LABELS[value as keyof typeof APPLICATION_CHANNEL_LABELS]
                : 'How did you apply?'
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(APPLICATION_CHANNEL_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <SubmitButton variant="outline" size="sm">
        Applied
      </SubmitButton>
    </form>
  )
}
