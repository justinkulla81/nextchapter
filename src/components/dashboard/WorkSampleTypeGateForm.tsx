'use client'

import { useActionState } from 'react'
import { submitWorkSampleType } from '@/app/dashboard/work-samples/actions'
import { Button } from '@/components/ui/button'

const OPTIONS = [
  { value: 'writing', label: 'Writing — articles, docs, proposals' },
  { value: 'code', label: 'Code — projects, repos, tools' },
  { value: 'design', label: 'Design — visual, product, UX work' },
  { value: 'other', label: 'Something else' },
  { value: 'none', label: "Nothing I'd want to share" },
]

export function WorkSampleTypeGateForm() {
  const [state, formAction, pending] = useActionState(submitWorkSampleType, undefined)

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Do you have real work you could show — writing, code, designs, a deck? A concrete sample
        does more to prove what you can do than another line on a resume.
      </p>
      <div className="flex flex-wrap gap-2">
        {OPTIONS.map((opt) => (
          <form key={opt.value} action={formAction}>
            <input type="hidden" name="workSampleType" value={opt.value} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {opt.label}
            </Button>
          </form>
        ))}
      </div>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </div>
  )
}
