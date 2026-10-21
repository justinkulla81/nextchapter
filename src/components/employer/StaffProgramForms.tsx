'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'
import { addInternalRole, setInternalRoleOpen } from '@/app/employer/(app)/growth/actions'
import { addCourse, setCourseActive } from '@/app/employer/(app)/learning/actions'

function Message({ state }: { state: { error?: string; ok?: string } | undefined }) {
  if (!state) return null
  return (
    <p role="status" className={cn('text-sm', state.error ? 'text-destructive' : 'text-brand')}>
      {state.error ?? state.ok}
    </p>
  )
}

// Clears the form only after a save worked; on an error everything typed stays.
function useResetOnOk(state: { ok?: string } | undefined) {
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state?.ok) ref.current?.reset()
  }, [state])
  return ref
}

export function AddInternalRoleForm() {
  const [state, action] = useActionState(addInternalRole, undefined)
  const ref = useResetOnOk(state)
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="role-title">Role title</Label>
        <Input id="role-title" name="title" required maxLength={140} placeholder="Senior financial analyst" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role-location">Location (optional)</Label>
        <Input id="role-location" name="location" maxLength={120} placeholder="Louisville, KY or remote" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="role-description">What the role is (optional)</Label>
        <Textarea id="role-description" name="description" rows={4} maxLength={4000} placeholder="The team, what the person will own, and what you're looking for." />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="role-apply">Apply link in your HR system (optional)</Label>
        <Input id="role-apply" name="applyUrl" type="url" placeholder="https://" />
        <p className="text-xs text-muted-foreground">Without one, people press “I’m interested” and you see their name here.</p>
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Posting…">Post role</SubmitButton>
        <Message state={state} />
      </div>
    </form>
  )
}

function ToggleButton({ label, pendingLabel, run, eventLabel }: { label: string; pendingLabel: string; run: () => Promise<{ error?: string }>; eventLabel: string }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        aria-label={eventLabel}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null)
            const r = await run()
            if (r.error) setError(r.error)
          })
        }
        className={cn('text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground', pending && 'cursor-wait')}
      >
        {pending ? pendingLabel : label}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}

export function InternalRoleOpenToggle({ postingId, title, open }: { postingId: string; title: string; open: boolean }) {
  return open ? (
    <ToggleButton label="Close role" pendingLabel="Closing…" eventLabel={`Close ${title}`} run={() => setInternalRoleOpen(postingId, false)} />
  ) : (
    <ToggleButton label="Reopen" pendingLabel="Reopening…" eventLabel={`Reopen ${title}`} run={() => setInternalRoleOpen(postingId, true)} />
  )
}

export function AddCourseForm() {
  const [state, action] = useActionState(addCourse, undefined)
  const ref = useResetOnOk(state)
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="course-title">Course title</Label>
        <Input id="course-title" name="title" required maxLength={140} placeholder="Google Data Analytics Certificate" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="course-provider">Provider (optional)</Label>
        <Input id="course-provider" name="provider" maxLength={80} placeholder="Coursera" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="course-url">Link (optional)</Label>
        <Input id="course-url" name="url" type="url" placeholder="https://" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="course-covered">What you cover (optional)</Label>
        <Input id="course-covered" name="covered" maxLength={80} placeholder="Fully covered, or up to $500" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="course-skills">Skills it builds (optional, comma separated)</Label>
        <Input id="course-skills" name="skills" placeholder="SQL, Tableau, data storytelling" />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="course-note">How to sign up (optional)</Label>
        <Textarea id="course-note" name="note" rows={2} maxLength={500} placeholder="Request a voucher from learning@yourcompany.com." />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton pendingLabel="Adding…">Add course</SubmitButton>
        <Message state={state} />
      </div>
    </form>
  )
}

export function CourseActiveToggle({ courseId, title, isActive }: { courseId: string; title: string; isActive: boolean }) {
  return isActive ? (
    <ToggleButton label="Hide" pendingLabel="Hiding…" eventLabel={`Hide ${title}`} run={() => setCourseActive(courseId, false)} />
  ) : (
    <ToggleButton label="Show again" pendingLabel="Showing…" eventLabel={`Show ${title} again`} run={() => setCourseActive(courseId, true)} />
  )
}
