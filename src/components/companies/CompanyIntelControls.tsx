'use client'

import { useActionState, useTransition, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { submitIntel, markHelpful, type ActionFormState } from '@/app/dashboard/companies/[slug]/actions'
import { INTEL_TYPES, INTEL_TYPE_LABEL, type IntelType } from '@/lib/companies/intel-types'

// "How to get hired here" contribution form — Prompt 3/4. Every prompt is
// framed toward process and preparation, never grievance (Prompt 5's
// non-disparagement guardrail); the placeholder copy below reinforces that
// framing at the point of writing, before moderation ever runs.
const PLACEHOLDER_BY_TYPE: Record<IntelType, string> = {
  interview_loop: 'e.g. "4 rounds: recruiter screen, hiring manager, panel, then a case study presentation."',
  timeline: 'e.g. "About 5 weeks from first call to offer."',
  what_they_test: 'e.g. "Heavy focus on stakeholder management scenarios, less on technical depth."',
  who_decides: 'e.g. "The hiring manager decides, but the panel has real veto power."',
  recruiter_responsiveness: 'e.g. "Recruiter followed up within 2-3 business days at every stage."',
  what_kills_candidates: 'e.g. "Vague answers to \'why us\' — they expect real company research."',
}

export function SubmitIntelForm({ companyId, companyPageId }: { companyId: string; companyPageId: string }) {
  const boundAction = submitIntel.bind(null, companyId, companyPageId)
  const [state, formAction, pending] = useActionState<ActionFormState, FormData>(boundAction, undefined)
  const [intelType, setIntelType] = useState<IntelType>('interview_loop')

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="intelType">What kind of guidance is this?</Label>
        <select
          id="intelType"
          name="intelType"
          value={intelType}
          onChange={(e) => setIntelType(e.target.value as IntelType)}
          className="flex h-10 w-full rounded-lg border border-input bg-transparent px-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
        >
          {INTEL_TYPES.map((t) => (
            <option key={t} value={t}>
              {INTEL_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="body">What should someone expect?</Label>
        <Textarea id="body" name="body" placeholder={PLACEHOLDER_BY_TYPE[intelType]} rows={4} required minLength={20} />
        <p className="text-xs text-muted-foreground">
          Focus on process and preparation, not grievances — this isn&apos;t a review. Never name a specific
          person.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="roleLevelAtTime">Your level at the time (optional)</Label>
          <Input id="roleLevelAtTime" name="roleLevelAtTime" placeholder="e.g. Director" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="recencyBucket">When was this?</Label>
          <select
            id="recencyBucket"
            name="recencyBucket"
            defaultValue="within_2yrs"
            className="flex h-10 w-full rounded-lg border border-input bg-transparent px-4 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand"
          >
            <option value="within_2yrs">Within 2 years</option>
            <option value="2_5yrs">2-5 years ago</option>
            <option value="5yrs_plus">5+ years ago</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="isAnonymous" defaultChecked />
        Show my contributor context only (e.g. &quot;a former Director&quot;), never my name
      </label>
      <SubmitButton pendingLabel="Submitting…" size="sm" className={pending ? 'w-fit cursor-progress' : 'w-fit'}>
        Submit
      </SubmitButton>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  )
}

export function MarkHelpfulButton({ intelId, companyPageId }: { intelId: string; companyPageId: string }) {
  const [pending, startTransition] = useTransition()
  const [voted, setVoted] = useState(false)
  return (
    <Button
      size="xs"
      variant="ghost"
      disabled={pending || voted}
      className={pending ? 'cursor-progress' : ''}
      onClick={() =>
        startTransition(async () => {
          await markHelpful(intelId, companyPageId)
          setVoted(true)
        })
      }
    >
      {voted ? 'Marked helpful' : 'Helpful'}
    </Button>
  )
}
