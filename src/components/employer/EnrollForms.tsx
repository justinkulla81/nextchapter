'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { enrollSingleAction, enrollBulkAction } from '@/app/employer/(app)/enroll/actions'
import type { EnrollableContract } from '@/lib/employer/outplacement-enrollment'

function ContractSelect({ contracts, id }: { contracts: EnrollableContract[]; id: string }) {
  return (
    <Select name="contractId" required>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Choose a contract" />
      </SelectTrigger>
      <SelectContent>
        {contracts.map((c) => {
          const remaining = c.seatCount - c.usedSeats
          return (
            <SelectItem key={c.id} value={c.id} disabled={remaining <= 0}>
              {(c.cohortLabel ?? c.tier)} — {remaining} of {c.seatCount} seats left
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

type Pkg = { key: string; name: string }

// Shown only when the program has packages; everyone else gets all services.
function PackageSelect({ packages, id }: { packages: Pkg[]; id: string }) {
  if (packages.length <= 1) return null
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Package</Label>
      <select id={id} name="packageKey" defaultValue="all" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
        {packages.map((p) => (
          <option key={p.key} value={p.key}>
            {p.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">Which services they get. Set packages up on the Program page.</p>
    </div>
  )
}

function SingleEnrollForm({ contracts, packages }: { contracts: EnrollableContract[]; packages: Pkg[] }) {
  const [state, formAction] = useActionState(enrollSingleAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state?.result && !state.error) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label htmlFor="single-contract">Contract</Label>
        <ContractSelect contracts={contracts} id="single-contract" />
      </div>
      <PackageSelect packages={packages} id="single-package" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="single-email">Their email</Label>
          <Input id="single-email" name="email" type="email" required placeholder="jane@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="single-name">Their name (optional)</Label>
          <Input id="single-name" name="name" placeholder="Jane Doe" />
        </div>
      </div>
      <SubmitButton pendingLabel="Enrolling…">Enroll</SubmitButton>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.result && !state.error && (
        <p className="text-sm text-brand">
          {state.result.outcome === 'invited' && `Invite sent to ${state.result.email}.`}
          {state.result.outcome === 'linked' && `${state.result.email} already had an account — benefit linked immediately.`}
        </p>
      )}
    </form>
  )
}

function BulkEnrollForm({ contracts, packages }: { contracts: EnrollableContract[]; packages: Pkg[] }) {
  const [state, formAction] = useActionState(enrollBulkAction, undefined)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state && !state.error) formRef.current?.reset()
  }, [state])

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label htmlFor="bulk-contract">Contract</Label>
        <ContractSelect contracts={contracts} id="bulk-contract" />
      </div>
      <PackageSelect packages={packages} id="bulk-package" />
      <div className="space-y-2">
        <Label htmlFor="bulk-file">CSV file</Label>
        <Input id="bulk-file" name="file" type="file" accept=".csv,text/csv" required />
        <p className="text-xs text-muted-foreground">Columns: email (required), name (optional). Up to 500 rows.</p>
      </div>
      <SubmitButton pendingLabel="Uploading…">Upload and enroll</SubmitButton>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state && !state.error && (
        <div className="space-y-1 text-sm">
          <p className="text-brand">
            {state.invited} invited, {state.linked} linked to existing accounts
            {state.failed > 0 ? `, ${state.failed} failed` : ''}.
          </p>
          {state.rowErrors.length > 0 && (
            <ul className="list-inside list-disc text-xs text-muted-foreground">
              {state.rowErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  )
}

export function EnrollForms({ contracts, packages = [] }: { contracts: EnrollableContract[]; packages?: Pkg[] }) {
  if (contracts.length === 0) {
    return (
      <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
        No contracts have open seats right now. Contact NextChapter to add seats or set up a new contract.
      </p>
    )
  }

  return (
    <Tabs defaultValue="single">
      <TabsList>
        <TabsTrigger value="single">Single enrollment</TabsTrigger>
        <TabsTrigger value="bulk">Bulk CSV</TabsTrigger>
      </TabsList>
      <TabsContent value="single" className="mt-4">
        <SingleEnrollForm contracts={contracts} packages={packages} />
      </TabsContent>
      <TabsContent value="bulk" className="mt-4">
        <BulkEnrollForm contracts={contracts} packages={packages} />
      </TabsContent>
    </Tabs>
  )
}
