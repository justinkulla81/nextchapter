'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { createOrgAction, createContractAction, inviteFirstAdminAction, type ActionState } from '@/app/support/admin/(portal)/outplacement-contracts/actions'

function ActionMessage({ state }: { state: ActionState }) {
  if (!state) return null
  return (
    <>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-brand">{state.success}</p>}
    </>
  )
}

export function CreateOrgForm() {
  const [state, formAction] = useActionState(createOrgAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.success) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="font-semibold">New organization</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="org-name">Organization name</Label>
          <Input id="org-name" name="name" required placeholder="Meridian Health" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-brand">Program brand name (optional)</Label>
          <Input id="org-brand" name="programBrandName" placeholder="Meridian Bridge" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-contact-name">Primary contact name</Label>
          <Input id="org-contact-name" name="primaryContactName" placeholder="Jordan Lee" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-contact-email">Primary contact email</Label>
          <Input id="org-contact-email" name="primaryContactEmail" type="email" required placeholder="jordan@meridianhealth.com" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="isSampleData" className="size-4" />
        Sample/test data (won&apos;t be confused with a real customer)
      </label>
      <SubmitButton pendingLabel="Creating…">Create organization</SubmitButton>
      <ActionMessage state={state} />
    </form>
  )
}

const TIER_OPTIONS: { value: 'CORE' | 'PLUS' | 'PREMIUM'; label: string }[] = [
  { value: 'CORE', label: 'Core' },
  { value: 'PLUS', label: 'Plus' },
  { value: 'PREMIUM', label: 'Premium' },
]

export function CreateContractForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(createContractAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.success) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="font-semibold">New contract</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contract-org">Organization</Label>
          <Select name="orgId" required>
            <SelectTrigger id="contract-org">
              <SelectValue placeholder="Choose an organization" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-cohort">Cohort label (optional)</Label>
          <Input id="contract-cohort" name="cohortLabel" placeholder="RIF — Q1 2026 Engineering" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-tier">Tier</Label>
          <Select name="tier" required>
            <SelectTrigger id="contract-tier">
              <SelectValue placeholder="Choose a tier" />
            </SelectTrigger>
            <SelectContent>
              {TIER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-seats">Seat count</Label>
          <Input id="contract-seats" name="seatCount" type="number" min={1} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-start">Term start</Label>
          <Input id="contract-start" name="termStartAt" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-end">Term end</Label>
          <Input id="contract-end" name="termEndAt" type="date" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-po">PO reference</Label>
          <Input id="contract-po" name="poReference" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contract-invoice">Invoice reference</Label>
          <Input id="contract-invoice" name="invoiceReference" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input type="checkbox" name="isSampleData" className="size-4" />
        Sample/test data
      </label>
      <SubmitButton pendingLabel="Creating…">Create contract</SubmitButton>
      <ActionMessage state={state} />
    </form>
  )
}

export function InviteFirstAdminForm({ orgs }: { orgs: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState(inviteFirstAdminAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.success) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border border-border p-4">
      <h3 className="font-semibold">Invite the first employer_admin</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="invite-org">Organization</Label>
          <Select name="orgId" required>
            <SelectTrigger id="invite-org">
              <SelectValue placeholder="Choose an organization" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input id="invite-email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-name">Name (optional)</Label>
          <Input id="invite-name" name="fullName" />
        </div>
      </div>
      <SubmitButton pendingLabel="Sending…">Send invite</SubmitButton>
      <ActionMessage state={state} />
    </form>
  )
}
