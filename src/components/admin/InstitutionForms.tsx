'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  createCollege,
  saveCollegeBranding,
  inviteCollegeStaff,
  type InstitutionFormState,
} from '@/app/support/admin/(portal)/institutions/actions'

const ROLE_OPTIONS = [
  ['INSTITUTION_ADMIN', 'Administrator'],
  ['CAREER_SERVICES', 'Career services'],
  ['EMPLOYER_RELATIONS', 'Employer relations'],
  ['ALUMNI_RELATIONS', 'Alumni relations'],
  ['DEVELOPMENT', 'Development'],
  ['VIEWER', 'Viewer'],
] as const

function Status({ state }: { state: InstitutionFormState }) {
  if (state?.error) return <p className="text-sm text-destructive">{state.error}</p>
  if (state?.ok) return <p className="text-sm text-muted-foreground">{state.ok}</p>
  return null
}

function BrandFields({ defaults }: { defaults?: { programBrandName: string | null; accentColor: string | null; tagline: string | null } }) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="programBrandName">Program name (optional)</Label>
        <Input id="programBrandName" name="programBrandName" defaultValue={defaults?.programBrandName ?? ''} placeholder="e.g. Presidents Career Network" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="accentColor">Brand colour</Label>
        <div className="flex items-center gap-2">
          <input id="accentColor" name="accentColor" type="color" defaultValue={defaults?.accentColor ?? '#1E4B8C'} className="h-10 w-14 rounded border border-input" />
          <span className="text-xs text-muted-foreground">Use the college’s primary colour.</span>
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tagline">Tagline (optional)</Label>
        <Input id="tagline" name="tagline" defaultValue={defaults?.tagline ?? ''} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="logo">Logo</Label>
        <Input id="logo" name="logo" type="file" accept="image/*" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="hero">Hero image</Label>
        <Input id="hero" name="hero" type="file" accept="image/*" />
      </div>
    </>
  )
}

export function CreateCollegeForm() {
  const [state, action] = useActionState(createCollege, undefined)
  return (
    <form action={action} className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="name">College name</Label>
        <Input id="name" name="name" required placeholder="Washington & Jefferson College" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="slug">Slug</Label>
        <Input id="slug" name="slug" required placeholder="washjeff" />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="domains">Email domains (staff and alumni)</Label>
        <Input id="domains" name="domains" placeholder="washjeff.edu" />
      </div>
      <BrandFields />
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="isDemo" defaultChecked /> Demo (not a signed customer)
      </label>
      <div className="space-y-2 sm:col-span-2">
        <Status state={state} />
        <SubmitButton pendingLabel="Creating…">Create college</SubmitButton>
      </div>
    </form>
  )
}

export function BrandingForm({
  institutionId,
  defaults,
}: {
  institutionId: string
  defaults: { programBrandName: string | null; accentColor: string | null; tagline: string | null }
}) {
  const [state, action] = useActionState(saveCollegeBranding.bind(null, institutionId), undefined)
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2">
      <BrandFields defaults={defaults} />
      <div className="space-y-2 sm:col-span-2">
        <Status state={state} />
        <SubmitButton size="sm" pendingLabel="Saving…">Save branding</SubmitButton>
      </div>
    </form>
  )
}

export function InviteStaffForm({ institutionId }: { institutionId: string }) {
  const [state, action] = useActionState(inviteCollegeStaff.bind(null, institutionId), undefined)
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label htmlFor={`email-${institutionId}`}>Email</Label>
        <Input id={`email-${institutionId}`} name="email" type="email" required />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`fn-${institutionId}`}>Name (optional)</Label>
        <Input id={`fn-${institutionId}`} name="fullName" />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`role-${institutionId}`}>Role</Label>
        <select id={`role-${institutionId}`} name="role" defaultValue="INSTITUTION_ADMIN" className="h-10 rounded-md border border-input bg-transparent px-3 text-sm">
          {ROLE_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <SubmitButton size="sm" pendingLabel="Sending…">Send invite</SubmitButton>
      <div className="w-full"><Status state={state} /></div>
    </form>
  )
}
