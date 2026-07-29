'use client'

import { ReferenceSubmissionForm } from '@/components/references/ReferenceSubmissionForm'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { submitEmployerReference } from './actions'

const RELATIONSHIP_OPTIONS: { value: string; label: string }[] = [
  { value: 'DIRECT_MANAGER', label: 'I was their direct manager' },
  { value: 'SKIP_LEVEL_MANAGER', label: 'I was their skip-level manager' },
  { value: 'PEER', label: 'We were peers' },
  { value: 'DIRECT_REPORT', label: 'They managed me' },
  { value: 'OTHER', label: 'Other' },
]

export function EmployerReferenceForm({
  dimensionGroups,
}: {
  dimensionGroups: { dimension: string; dimensionLabel: string; anchors: { scalePoint: number; anchorText: string }[] }[]
}) {
  return (
    <ReferenceSubmissionForm
      candidateName="them"
      dimensionGroups={dimensionGroups}
      action={submitEmployerReference}
      submitLabel="Send reference & invite"
      beforeContent={
        <div className="space-y-6 border-b border-border pb-6">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">About you</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="submitterName">Your name</Label>
                <Input id="submitterName" name="submitterName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitterTitle">Your title (optional)</Label>
                <Input id="submitterTitle" name="submitterTitle" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitterCompany">Your company</Label>
                <Input id="submitterCompany" name="submitterCompany" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="submitterEmail">Your work email</Label>
                <Input id="submitterEmail" name="submitterEmail" type="email" required />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-medium text-muted-foreground">Who you&apos;re referencing</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="employeeName">Their name</Label>
                <Input id="employeeName" name="employeeName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employeeEmail">Their email</Label>
                <Input id="employeeEmail" name="employeeEmail" type="email" required />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              That&apos;s all we need about them at this stage — no salary or performance data.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="relationshipType">Your relationship</Label>
              <select
                id="relationshipType"
                name="relationshipType"
                required
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">Choose one</option>
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="yearsWorkedTogether">Years worked together (optional)</Label>
              <Input id="yearsWorkedTogether" name="yearsWorkedTogether" type="number" min={0} max={40} />
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-border p-4">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="isLayoffContext" value="yes" className="mt-1" />
              <span>
                Is this part of a broader layoff or reduction? <span className="text-muted-foreground">(optional)</span>
              </span>
            </label>
          </div>
        </div>
      }
    />
  )
}
