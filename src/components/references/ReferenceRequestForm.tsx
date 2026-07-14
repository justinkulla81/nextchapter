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

export function ReferenceRequestForm() {
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
          <Input id="refereeName" name="refereeName" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="refereeEmail">Their email</Label>
          <Input id="refereeEmail" name="refereeEmail" type="email" required />
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
