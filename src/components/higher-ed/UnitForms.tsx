'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { addUnitAction, type UnitState } from '@/app/i/[slug]/(portal)/unit-actions'
import { inviteStaff } from '@/app/i/[slug]/(portal)/staff-actions'

type FormState = { error?: string; ok?: boolean; message?: string } | undefined

// Add a school or department. The school list suggests the names already in the roster's school column.
export function AddUnitForm({ slug, schools }: { slug: string; schools: string[] }) {
  const [state, action] = useActionState<UnitState, FormData>(addUnitAction.bind(null, slug), undefined)
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-56 flex-1 space-y-1.5">
        <Label htmlFor="unit-school">School</Label>
        <Input id="unit-school" name="school" list="unit-schools" required defaultValue={state?.values?.school ?? ''} placeholder="e.g. Tepper School of Business" />
        <datalist id="unit-schools">
          {schools.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div className="min-w-48 flex-1 space-y-1.5">
        <Label htmlFor="unit-dept">Department (optional)</Label>
        <Input id="unit-dept" name="department" defaultValue={state?.values?.department ?? ''} placeholder="Leave empty for the whole school" />
      </div>
      <SubmitButton pendingLabel="Adding…">Add school or department</SubmitButton>
      {state?.error && <p role="alert" className="w-full text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p role="status" className="w-full text-sm text-success">{state.message}</p>}
    </form>
  )
}

// Invite a unit's administrator: a whole-institution staff invite limited to that unit.
export function UnitAdminInvite({ slug, unitId, unitName }: { slug: string; unitId: string; unitName: string }) {
  const [state, action] = useActionState<FormState, FormData>(inviteStaff.bind(null, slug), undefined)
  if (state?.ok) return <p role="status" className="text-sm text-success">Invite sent.</p>
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="role" value="INSTITUTION_ADMIN" />
      <input type="hidden" name="unitId" value={unitId} />
      <div className="space-y-1">
        <Label htmlFor={`unit-admin-${unitId}`} className="text-xs">
          Invite {unitName}&apos;s administrator
        </Label>
        <Input id={`unit-admin-${unitId}`} name="email" type="email" required placeholder="Work email" className="w-64" />
      </div>
      <SubmitButton size="sm" pendingLabel="Sending…">
        Send invite
      </SubmitButton>
      {state?.error && <p role="alert" className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  )
}
