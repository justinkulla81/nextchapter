'use client'

import { useActionState } from 'react'
import { addWorkSample } from '@/app/dashboard/work-samples/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const SAMPLE_TYPE_OPTIONS = [
  { value: 'case_study', label: 'Case study' },
  { value: 'writing', label: 'Writing' },
  { value: 'code', label: 'Code' },
  { value: 'design', label: 'Design' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'other', label: 'Other' },
]

export function WorkSampleForm() {
  const [state, formAction, pending] = useActionState(addWorkSample, undefined)

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sampleType">Type</Label>
        <Select name="sampleType" defaultValue="case_study">
          <SelectTrigger id="sampleType" className="w-full">
            <SelectValue placeholder="Select one">
              {(value: string | null) =>
                SAMPLE_TYPE_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select one'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SAMPLE_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="problemStatement">What was the problem? (optional)</Label>
        <Textarea id="problemStatement" name="problemStatement" rows={2} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="candidateRole">Your role (optional)</Label>
          <Input id="candidateRole" name="candidateRole" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="outcome">Outcome (optional)</Label>
          <Input id="outcome" name="outcome" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="externalUrl">Link to your work (optional if uploading a file)</Label>
        <Input id="externalUrl" name="externalUrl" type="url" placeholder="https://" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="file">Or upload a file (PDF or image, up to 10MB)</Label>
        <Input id="file" name="file" type="file" accept=".pdf,image/*" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Uploading…' : 'Add work sample'}
      </Button>
    </form>
  )
}
