'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import type { HiringReqStatus } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { createReqAction, updateReqStatusAction, type ReqActionState } from '@/app/hiring/(app)/reqs/actions'

interface ReqRow {
  id: string
  title: string
  status: HiringReqStatus
  createdAt: Date
  _count: { submissions: number }
}

const STATUS_OPTIONS: HiringReqStatus[] = ['OPEN', 'FILLED', 'CLOSED']
const STATUS_LABEL: Record<HiringReqStatus, string> = { OPEN: 'Open', FILLED: 'Filled', CLOSED: 'Closed' }

export function ReqList({ reqs }: { reqs: ReqRow[] }) {
  return (
    <div className="space-y-6">
      <NewReqForm />
      {reqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reqs yet. Create one above — submissions a recruiter sends for a matching role at your company
          link to it automatically.
        </p>
      ) : (
        <div className="space-y-3">
          {reqs.map((req) => (
            <ReqRowView key={req.id} req={req} />
          ))}
        </div>
      )}
    </div>
  )
}

function NewReqForm() {
  const [state, formAction, pending] = useActionState<ReqActionState, FormData>(createReqAction, undefined)

  return (
    <form
      action={formAction}
      className={pending ? 'cursor-progress flex flex-wrap items-end gap-2 rounded-lg border border-border p-4 [&_*]:cursor-progress' : 'flex flex-wrap items-end gap-2 rounded-lg border border-border p-4'}
    >
      <div className="flex-1 space-y-1">
        <Label htmlFor="title">Role title</Label>
        <Input id="title" name="title" required placeholder="e.g. VP Finance" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create req'}
      </Button>
      {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  )
}

function ReqRowView({ req }: { req: ReqRow }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
      <div>
        <Link href="/hiring/dashboard" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
          {req.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {req._count.submissions} candidate{req._count.submissions === 1 ? '' : 's'} submitted
        </p>
      </div>
      <div className="flex items-center gap-1.5">
        {STATUS_OPTIONS.map((status) => (
          <form key={status} action={updateReqStatusAction.bind(null, req.id, status)}>
            <SubmitButton
              size="sm"
              variant={req.status === status ? 'default' : 'outline'}
              disabled={req.status === status}
            >
              {STATUS_LABEL[status]}
            </SubmitButton>
          </form>
        ))}
      </div>
    </div>
  )
}
