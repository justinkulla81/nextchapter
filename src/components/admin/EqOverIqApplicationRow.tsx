'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConfirmForm } from '@/components/admin/ConfirmForm'
import { approveEqOverIqApplication, rejectEqOverIqApplication } from '@/app/support/admin/(portal)/eqoveriq-applications/actions'
import { cn } from '@/lib/utils'

const INTEREST_AREA_LABEL: Record<string, string> = {
  MODEL_EVALUATION: 'Model evaluation',
  RED_TEAMING: 'Red teaming',
  DATA_LABELING: 'Data labeling',
  PROMPT_ENGINEERING: 'Prompt engineering',
  RLHF: 'RLHF',
  FINE_TUNING: 'Fine-tuning',
  GENERALIST: 'Generalist',
}

interface EqOverIqApplicationRowProps {
  id: string
  fullName: string
  email: string
  background: string
  experienceSummary: string
  portfolioLinks: string[]
  interestAreas: string[]
  whyFractionalAiWork: string
  submittedAt: string
}

export function EqOverIqApplicationRow({
  id,
  fullName,
  email,
  background,
  experienceSummary,
  portfolioLinks,
  interestAreas,
  whyFractionalAiWork,
  submittedAt,
}: EqOverIqApplicationRowProps) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className={cn('space-y-3 rounded-lg border border-border p-4', isPending && 'cursor-wait [&_*]:cursor-wait')}>
      <div>
        <Link href={`/support/admin/eqoveriq-contributors/${id}`} className="font-medium text-primary underline underline-offset-4">
          {fullName || 'Unnamed'}
        </Link>{' '}
        <span className="text-sm text-muted-foreground">
          ({email}) · applied {submittedAt}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <p>
          <span className="font-medium text-foreground">Background:</span>{' '}
          <span className="text-muted-foreground">{background}</span>
        </p>
        <p>
          <span className="font-medium text-foreground">Experience:</span>{' '}
          <span className="text-muted-foreground">{experienceSummary}</span>
        </p>
        <p>
          <span className="font-medium text-foreground">Interested in:</span>{' '}
          <span className="text-muted-foreground">
            {interestAreas.map((a) => INTEREST_AREA_LABEL[a] ?? a).join(', ')}
          </span>
        </p>
        <p>
          <span className="font-medium text-foreground">Why fractional AI work:</span>{' '}
          <span className="text-muted-foreground">{whyFractionalAiWork}</span>
        </p>
        {portfolioLinks.length > 0 && (
          <p>
            <span className="font-medium text-foreground">Links:</span>{' '}
            {portfolioLinks.map((link) => (
              <a key={link} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noopener noreferrer" className="mr-2 text-primary underline underline-offset-4">
                {link}
              </a>
            ))}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isPending}
          onClick={() => startTransition(() => approveEqOverIqApplication(id))}
        >
          Approve
        </Button>
        <ConfirmForm
          action={() => rejectEqOverIqApplication(id)}
          confirmMessage={`Reject ${fullName || 'this applicant'}'s application? There's no resubmission flow in v1 — you can still change the decision later from their detail page.`}
        >
          <SubmitButton size="sm" variant="outline">
            Reject
          </SubmitButton>
        </ConfirmForm>
      </div>
    </div>
  )
}
