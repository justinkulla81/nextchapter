'use client'

import { useActionState } from 'react'
import { createCommunityPost } from '@/app/dashboard/community/actions'
import { COMMUNITY_POST_TYPE_LABELS } from '@/lib/constants/community'
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

const POST_TYPE_OPTIONS = Object.entries(COMMUNITY_POST_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function CommunityPostForm() {
  const [state, formAction, pending] = useActionState(createCommunityPost, undefined)

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <Label htmlFor="postType">Post type</Label>
        <Select name="postType" defaultValue="JOB">
          <SelectTrigger id="postType" className="w-full">
            <SelectValue placeholder="Select one">
              {(value: string | null) =>
                POST_TYPE_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select one'
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {POST_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="externalUrl">Link (optional)</Label>
        <Input id="externalUrl" name="externalUrl" type="url" placeholder="https://" />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Posting…' : 'Post to Community Board'}
      </Button>
    </form>
  )
}
