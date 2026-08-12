'use client'

import { useActionState } from 'react'
import { requestReference } from '@/app/dashboard/references/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RELATIONSHIP_TYPE_LABELS, RELATIONSHIP_TYPE_HELP } from '@/lib/constants/references'
import { cn } from '@/lib/utils'

export function ReferenceRequestForm({
  initialName,
  initialEmail,
  workHistoryEntries = [],
}: {
  initialName?: string
  initialEmail?: string
  // Lets the candidate tie this reference to one of their own jobs, so the
  // ref token page can ask the referee to verify that job's title/company/
  // resume bullet instead of nothing at all. Optional — omit entirely for
  // references that don't map to a single role (e.g. a peer who knew the
  // candidate across several).
  workHistoryEntries?: { id: string; companyName: string; roleTitle: string }[]
} = {}) {
  const [state, formAction, pending] = useActionState(requestReference, undefined)

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
          <Label htmlFor="refereeName">Their name</Label>
          <Input id="refereeName" name="refereeName" defaultValue={initialName} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="refereeEmail">Their email</Label>
          <Input id="refereeEmail" name="refereeEmail" type="email" defaultValue={initialEmail} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="refereeTitle">Their title (optional)</Label>
          <Input id="refereeTitle" name="refereeTitle" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="refereeCompany">Company (optional)</Label>
          <Input id="refereeCompany" name="refereeCompany" />
        </div>
      </div>

      {workHistoryEntries.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="workHistoryEntryId">Which job was this for? (optional)</Label>
          <Select name="workHistoryEntryId">
            <SelectTrigger id="workHistoryEntryId" className="w-full">
              <SelectValue placeholder="Not tied to one specific job" />
            </SelectTrigger>
            <SelectContent>
              {workHistoryEntries.map((entry) => (
                <SelectItem key={entry.id} value={entry.id}>
                  {entry.roleTitle} at {entry.companyName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Lets them confirm your title, company, and one resume highlight from that role.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="relationshipType">How did you work together?</Label>
        <Select name="relationshipType" defaultValue="DIRECT_MANAGER">
          <SelectTrigger id="relationshipType" className="w-full">
            <SelectValue placeholder="Select one">
              {(value: string | null) =>
                value
                  ? RELATIONSHIP_TYPE_LABELS[value as keyof typeof RELATIONSHIP_TYPE_LABELS]
                  : 'Select one'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(RELATIONSHIP_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{RELATIONSHIP_TYPE_HELP}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="yearsWorkedTogether">Years worked together (optional)</Label>
        <Input id="yearsWorkedTogether" name="yearsWorkedTogether" type="number" min={0} max={40} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Request reference'}
      </Button>
    </form>
  )
}
