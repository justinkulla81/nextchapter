'use client'

import { useActionState, useState } from 'react'
import type { Course, CourseCategory } from '@prisma/client'
import type { FormState } from '@/app/support/admin/(portal)/courses/actions'
import { COURSE_SKILL_LEVELS, COURSE_SKILL_LEVEL_LABELS } from '@/lib/constants/course-skill-level'
import { PRIMARY_FUNCTION_OPTIONS } from '@/lib/constants/onboarding'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

const PROVIDERS = [
  { value: 'coursera', label: 'Coursera' },
  { value: 'edx', label: 'edX' },
  { value: 'emeritus', label: 'Emeritus' },
  { value: 'toastmasters', label: 'Toastmasters' },
  { value: 'universityExecEd', label: 'University executive education' },
  { value: 'certificationBody', label: 'Certification body' },
  { value: 'hubspotAcademy', label: 'HubSpot Academy' },
]

const CATEGORIES: { value: CourseCategory; label: string; hint: string }[] = [
  { value: 'AI_TRAINING', label: 'AI Training', hint: "Skill level picks which tier shows by default, based on the candidate's AI-skill confidence." },
  { value: 'BUSINESS_SKILLS', label: 'Business Skills', hint: 'General business courses, or check "Requires management signal" for leadership-only content.' },
  { value: 'CERTIFICATION', label: 'Certification', hint: 'Shown only to candidates in the target function(s) you pick below.' },
  { value: 'FUNCTION_TRAINING', label: 'Function Training', hint: "Shown when a candidate's role matches one of the keywords below." },
  { value: 'SPEAKING', label: 'Public Speaking', hint: 'General speaking content, or check "Requires management signal" for leadership-only content.' },
]

export function CourseForm({
  action,
  existing,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  existing?: Course
}) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [category, setCategory] = useState<CourseCategory>(existing?.category ?? 'AI_TRAINING')

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <select
          id="category"
          name="category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value as CourseCategory)}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">{CATEGORIES.find((c) => c.value === category)?.hint}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required defaultValue={existing?.title} placeholder="e.g. AI For Everyone" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          required
          defaultValue={existing?.description}
          placeholder="One sentence on what this course covers"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="logoUrl">Logo URL (optional)</Label>
          <Input id="logoUrl" name="logoUrl" defaultValue={existing?.logoUrl ?? ''} placeholder="https://…" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="url">Link</Label>
          <Input id="url" name="url" required defaultValue={existing?.url} placeholder="https://…" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sponsor">Sponsor (optional)</Label>
          <Input
            id="sponsor"
            name="sponsor"
            defaultValue={existing?.sponsor ?? ''}
            placeholder="e.g. DeepLearning.AI"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="provider">Platform</Label>
          <select
            id="provider"
            name="provider"
            defaultValue={existing?.provider ?? 'coursera'}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {category === 'CERTIFICATION' && (
        <div className="space-y-2">
          <Label>Target functions</Label>
          <div className="flex flex-wrap gap-2">
            {PRIMARY_FUNCTION_OPTIONS.map((fn) => (
              <label
                key={fn}
                className="flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              >
                <input
                  type="checkbox"
                  name="targetFunctions"
                  value={fn}
                  defaultChecked={existing?.targetFunctions.includes(fn)}
                />
                {fn}
              </label>
            ))}
          </div>
        </div>
      )}

      {category === 'FUNCTION_TRAINING' && (
        <div className="space-y-2">
          <Label htmlFor="keywords">Keywords (one per line)</Label>
          <Textarea
            id="keywords"
            name="keywords"
            rows={3}
            defaultValue={existing?.keywords.join('\n') ?? ''}
            placeholder={'engineer\ndeveloper\nsoftware'}
          />
          <p className="text-xs text-muted-foreground">
            Shown when a candidate&apos;s resolved function/role contains any of these words.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="skillLevel">Skill level</Label>
        <div className="flex gap-2">
          {COURSE_SKILL_LEVELS.map((level) => (
            <label
              key={level}
              className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="skillLevel"
                value={level}
                required
                defaultChecked={existing ? existing.skillLevel === level : level === 'BEGINNER'}
              />
              {COURSE_SKILL_LEVEL_LABELS[level]}
            </label>
          ))}
        </div>
        {category === 'AI_TRAINING' && (
          <p className="text-xs text-muted-foreground">
            Aligned to a candidate&apos;s self-reported AI-skill confidence — low confidence defaults to Beginner,
            high confidence defaults to Advanced.
          </p>
        )}
      </div>

      {(category === 'BUSINESS_SKILLS' || category === 'SPEAKING') && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="requiresManagementSignal" defaultChecked={existing?.requiresManagementSignal ?? false} />
          Requires management signal (people manager, exec title, or targeting a leadership role)
        </label>
      )}
      {category === 'BUSINESS_SKILLS' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="excludeIfHasMBA" defaultChecked={existing?.excludeIfHasMBA ?? false} />
          Hide from candidates who already have an MBA
        </label>
      )}

      <div className="grid grid-cols-3 gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="free" defaultChecked={existing?.free ?? false} />
          Free
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={existing?.isActive ?? true} />
          Active (shown to candidates)
        </label>
        <div className="space-y-2">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input
            id="sortOrder"
            name="sortOrder"
            type="number"
            defaultValue={existing?.sortOrder ?? ''}
            placeholder="Optional"
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel={existing ? 'Saving…' : 'Adding…'}>
        {existing ? 'Save changes' : 'Add course'}
      </SubmitButton>
    </form>
  )
}
