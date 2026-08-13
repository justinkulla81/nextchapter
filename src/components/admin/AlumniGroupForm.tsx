'use client'

import { useActionState } from 'react'
import type { AlumniNetworkGroup } from '@prisma/client'
import type { FormState } from '@/app/support/admin/(portal)/alumni-groups/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

export function AlumniGroupForm({
  action,
  existing,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  existing?: AlumniNetworkGroup
}) {
  const [state, formAction, pending] = useActionState(action, undefined)

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required defaultValue={existing?.name} placeholder="e.g. Xoogler" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="matchType">Matches against</Label>
          <select
            id="matchType"
            name="matchType"
            required
            defaultValue={existing?.matchType ?? 'EMPLOYER'}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="EMPLOYER">Employer (work history)</option>
            <option value="SCHOOL">School (education)</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="url">Link</Label>
          <Input id="url" name="url" required defaultValue={existing?.url} placeholder="https://…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo URL (optional)</Label>
          <Input
            id="logoUrl"
            name="logoUrl"
            defaultValue={existing?.logoUrl ?? ''}
            placeholder="https://logo.clearbit.com/google.com"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          defaultValue={existing?.description ?? ''}
          placeholder="One short line shown on the candidate-facing card"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="keywords">Match keywords (one per line)</Label>
        <Textarea
          id="keywords"
          name="keywords"
          rows={3}
          required
          defaultValue={existing?.keywords.join('\n') ?? ''}
          placeholder={'google\nalphabet'}
        />
        <p className="text-xs text-muted-foreground">
          Matched case-insensitively, both directions, against every company name in a candidate&apos;s work
          history (Employer) or every normalized school name in their education (School).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={existing?.isActive ?? true} />
          Active (shown to candidates)
        </label>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort order (optional)</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={existing?.sortOrder ?? ''} />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel={existing ? 'Saving…' : 'Adding…'}>
        {existing ? 'Save changes' : 'Add group'}
      </SubmitButton>
    </form>
  )
}
