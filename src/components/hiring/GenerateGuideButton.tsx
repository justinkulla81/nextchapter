'use client'

import { SubmitButton } from '@/components/ui/submit-button'
import { generateInterviewGuideAction } from '@/app/hiring/(app)/candidates/[submissionId]/actions'

export function GenerateGuideButton({ submissionId, hasGuide }: { submissionId: string; hasGuide: boolean }) {
  return (
    <form action={generateInterviewGuideAction.bind(null, submissionId)}>
      <SubmitButton size="sm" variant={hasGuide ? 'outline' : 'default'} pendingLabel="Generating…">
        {hasGuide ? 'Regenerate guide' : 'Generate interview guide'}
      </SubmitButton>
    </form>
  )
}
