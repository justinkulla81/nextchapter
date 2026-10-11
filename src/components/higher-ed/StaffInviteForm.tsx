'use client'

import { useActionState, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { ROLE_LABEL } from '@/lib/institution/permissions'

type State = { error?: string; ok?: boolean; message?: string } | undefined

const ROLES = ['CAREER_SERVICES', 'ALUMNI_RELATIONS', 'DEVELOPMENT', 'EMPLOYER_RELATIONS', 'COACH', 'FACULTY', 'EXEC_ED', 'VIEWER', 'INSTITUTION_ADMIN'] as const

// Admin › Staff. Emails a sign-in link; the person lands in this college's
// portal with the role picked here. Inputs are controlled so a failed invite
// keeps what was typed.
export function StaffInviteForm({ inviteAction }: { inviteAction: (prev: State, formData: FormData) => Promise<State> }) {
  const [state, action] = useActionState(inviteAction, undefined)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<string>('CAREER_SERVICES')

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
      <p className="w-full text-sm font-semibold">Invite a staff member</p>
      <div className="min-w-56 flex-1 space-y-1.5">
        <Label htmlFor="invite-email">Work email</Label>
        <Input id="invite-email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor="invite-name">Full name (optional)</Label>
        <Input id="invite-name" name="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-role">Role</Label>
        <select
          id="invite-role"
          name="role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      <SubmitButton pendingLabel="Sending…" savedLabel="Sent">
        Send invite
      </SubmitButton>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="w-full text-sm text-muted-foreground">
          {state.message}
        </p>
      )}
    </form>
  )
}
