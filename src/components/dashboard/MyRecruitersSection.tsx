'use client'

import { useActionState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { INTAKE_CONSENT_SCOPES, INTAKE_CONSENT_SCOPE_LABELS } from '@/lib/recruiter/intake/constants'
import { disconnectFromFirm, updateFirmSharing } from '@/app/dashboard/privacy/talent-actions'

type Connection = { id: string; firmName: string; recruiterName: string | null; source: string; scopes: string[] }

function FirmSharing({ connection }: { connection: Connection }) {
  const [state, formAction, pending] = useActionState(updateFirmSharing, undefined)
  const [disconnecting, start] = useTransition()
  const router = useRouter()

  return (
    <li className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium">{connection.firmName}</p>
          <p className="text-xs text-muted-foreground">
            {connection.recruiterName ? `${connection.recruiterName} · ` : ''}
            {connection.source}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disconnecting}
          className={cn(disconnecting && 'cursor-progress')}
          onClick={() => {
            if (!window.confirm(`Disconnect from ${connection.firmName}? They stop seeing your updates, and your resume is no longer shared with them through NextChapter.`)) return
            start(async () => {
              await disconnectFromFirm(connection.id)
              router.refresh()
            })
          }}
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      </div>
      <form action={formAction} className={cn('space-y-2', pending && 'cursor-progress [&_*]:cursor-progress')}>
        <input type="hidden" name="connectionId" value={connection.id} />
        <p className="text-sm text-muted-foreground">What {connection.firmName} can see:</p>
        {INTAKE_CONSENT_SCOPES.map((scope) => (
          <label key={scope} className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="consent" value={scope} defaultChecked={connection.scopes.includes(scope)} className="mt-0.5 size-4" />
            <span>
              <span className="font-medium">{INTAKE_CONSENT_SCOPE_LABELS[scope].label}</span>
              <span className="block text-muted-foreground">{INTAKE_CONSENT_SCOPE_LABELS[scope].detail}</span>
            </span>
          </label>
        ))}
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <SubmitButton size="sm" pendingLabel="Saving…">
          Save
        </SubmitButton>
      </form>
    </li>
  )
}

export function MyRecruitersSection({ connections }: { connections: Connection[] }) {
  return (
    <ul className="space-y-3">
      {connections.map((c) => (
        <FirmSharing key={c.id} connection={c} />
      ))}
    </ul>
  )
}
