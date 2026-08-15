'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { inviteOrgUserAction } from '@/app/employer/(app)/team/actions'

const ROLE_OPTIONS: { value: 'ADMIN' | 'VIEWER' | 'LEGAL' | 'FINANCE'; label: string }[] = [
  { value: 'ADMIN', label: 'Admin — enroll, billing, all reporting' },
  { value: 'VIEWER', label: 'Viewer — reporting only' },
  { value: 'LEGAL', label: 'Legal — compliance pack only' },
  { value: 'FINANCE', label: 'Finance — invoices only' },
]

export function InviteOrgUserForm() {
  const [state, formAction] = useActionState(inviteOrgUserAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.sent) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="team-email">Email</Label>
          <Input id="team-email" name="email" type="email" required placeholder="teammate@company.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="team-name">Name (optional)</Label>
          <Input id="team-name" name="fullName" placeholder="Jordan Lee" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="team-role">Role</Label>
          <Select name="role" required defaultValue="VIEWER">
            <SelectTrigger id="team-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <SubmitButton pendingLabel="Sending invite…">Send invite</SubmitButton>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.sent && <p className="text-sm text-brand">Invite sent.</p>}
    </form>
  )
}
