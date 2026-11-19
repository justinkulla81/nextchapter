'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { reuseLeadResume } from '@/app/onboarding/resume-actions'
import type { StartUploadState } from '@/app/onboarding/resume-actions'

// On the résumé step: the résumé this person already dropped on a public page, one click to use it (no second upload).
export function UseSentResume({ fileName }: { fileName: string }) {
  const [state, action, pending] = useActionState<StartUploadState, FormData>(reuseLeadResume, undefined)
  return (
    <form action={action} onSubmit={() => posthog.capture('lead_resume_reuse_clicked', {})} className={cn('rounded-xl border-2 border-action/40 bg-white p-4', pending && 'cursor-wait')}>
      <p className="text-sm text-navy">
        You already sent us <span className="font-semibold">{fileName}</span>.
      </p>
      <Button type="submit" disabled={pending} className="mt-3 h-11 rounded-full bg-action px-5 text-action-foreground hover:brightness-95">
        {pending ? 'Reading it…' : 'Use this résumé'}
      </Button>
      {state?.error && <p role="alert" className="mt-2 text-sm text-destructive">{state.error}</p>}
      <p className="mt-2 text-xs text-muted-foreground">Or upload a newer one below.</p>
    </form>
  )
}
