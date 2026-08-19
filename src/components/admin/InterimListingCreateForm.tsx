'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/support/admin/(portal)/interim-listings/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const CATEGORY_LABELS: Record<string, string> = {
  MARKETPLACE_TECHNICAL: 'Marketplace — technical/AI',
  MARKETPLACE_GENERAL: 'Marketplace — general (ops/strategy/finance)',
  MARKETPLACE_MARKETING: 'Marketplace — marketing',
  MARKETPLACE_STARTUP: 'Marketplace — startup-stage operator',
  MARKETPLACE_ANY_FUNCTION: 'Marketplace — any function',
  EXPERT_NETWORK: 'Expert network',
  BOARD_ADVISORY: 'Board & advisory',
  NONPROFIT_BOARD: 'Nonprofit board',
}

const DESIGNATION_LABELS: Record<string, string> = {
  PARTNER: 'Partner',
  INCLUDED_FOR_QUALITY: 'Included for quality',
}

export function InterimListingCreateForm({
  action,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
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
      <h2 className="font-medium">Add a listing</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Select name="category">
            <SelectTrigger id="category">
              <SelectValue placeholder="Choose a category">
                {(v: string | null) => (v ? CATEGORY_LABELS[v] : 'Choose a category')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="designation">Designation</Label>
          <Select name="designation" defaultValue="INCLUDED_FOR_QUALITY">
            <SelectTrigger id="designation">
              <SelectValue>{(v: string | null) => (v ? DESIGNATION_LABELS[v] : undefined)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PARTNER">Partner</SelectItem>
              <SelectItem value="INCLUDED_FOR_QUALITY">Included for quality</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="url">URL</Label>
        <Input id="url" name="url" type="url" required placeholder="https://" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="logoUrl">Logo URL (optional)</Label>
        <Input id="logoUrl" name="logoUrl" type="url" placeholder="https://" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" required rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="designationNote">Designation note (optional)</Label>
        <Textarea
          id="designationNote"
          name="designationNote"
          rows={2}
          placeholder="Any nuance on the Partner/Included-for-quality label worth showing candidates."
        />
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Adding…">Add listing</SubmitButton>
    </form>
  )
}
