'use client'

import { useActionState, useState } from 'react'
import { uploadResume } from '@/app/dashboard/resume/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { NewNarrativeForm } from '@/components/dashboard/portfolio/NarrativeManager'
import { ExistingAccountNotice } from '@/components/auth/ExistingAccountNotice'
import { InlineLoadingState } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const NEW_NARRATIVE_VALUE = '__new__'
const NONE_VALUE = '__none__'

export interface ResumeUploadNarrativeOption {
  id: string
  label: string
}

export function ResumeUploadForm({
  narratives = [],
  showNarrativePicker = true,
  resumeBookOptIn = true,
}: {
  narratives?: ResumeUploadNarrativeOption[]
  // Off during onboarding (see /onboarding/resume) — a brand-new candidate
  // can't have a narrative yet at that step, so offering "align to a
  // narrative" (including "+ New narrative") there is a dead-end option,
  // not a real choice.
  showNarrativePicker?: boolean
  // Current CandidateProfile.resumeBookOptIn — defaults true since a
  // brand-new onboarding visitor has no profile yet to read this from, and
  // true is also the schema default every new profile gets anyway.
  resumeBookOptIn?: boolean
}) {
  const [state, formAction, pending] = useActionState(uploadResume, undefined)
  const [hasFile, setHasFile] = useState(false)
  const [narrativeChoice, setNarrativeChoice] = useState<string>(NONE_VALUE)
  const [creatingNarrative, setCreatingNarrative] = useState(false)

  if (state?.existingAccountFound) {
    return <ExistingAccountNotice needsPassword={false} />
  }

  if (state?.existingAccountNeedsPassword) {
    return <ExistingAccountNotice needsPassword email={state.existingAccountEmail} />
  }

  const selectedNarrativeId = narrativeChoice === NONE_VALUE || narrativeChoice === NEW_NARRATIVE_VALUE ? '' : narrativeChoice

  return (
    <form
      action={formAction}
      className={cn(
        'space-y-4 rounded-lg border border-border p-4',
        pending && 'cursor-progress [&_*]:cursor-progress'
      )}
    >
      <div className="space-y-2">
        <Label htmlFor="file">Upload your resume (PDF or DOCX, up to 10MB)</Label>
        {/* The "Choose File" pseudo-button (the input's ::file-selector-button)
            starts green — the one thing to do — and turns gray once a file is
            picked, handing the "next action" spotlight to the Upload button
            below instead. */}
        <Input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.docx"
          required
          disabled={pending}
          onChange={(e) => setHasFile(e.target.files !== null && e.target.files.length > 0)}
          className={cn(
            !hasFile && 'file:bg-success file:text-white hover:file:bg-success-hover',
            pending && 'file:cursor-progress'
          )}
        />
      </div>

      {showNarrativePicker && (
        <>
          <div className="space-y-2">
            <Label htmlFor="narrativeChoice">Align to a narrative (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Pick one of your narratives and the analysis will ground its suggestions in that story —
              e.g. flagging spots where the resume&apos;s framing doesn&apos;t match it.
            </p>
            <Select
              name="narrativeChoiceDisplay"
              value={narrativeChoice}
              onValueChange={(value) => {
                const next = value ?? NONE_VALUE
                setNarrativeChoice(next)
                setCreatingNarrative(next === NEW_NARRATIVE_VALUE)
              }}
            >
              <SelectTrigger id="narrativeChoice" disabled={pending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE_VALUE}>None</SelectItem>
                {narratives.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.label}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_NARRATIVE_VALUE}>+ New narrative</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="narrativeId" value={selectedNarrativeId} />
          </div>

          {creatingNarrative && (
            <NewNarrativeForm
              defaultOpen
              onCreated={(id) => {
                setCreatingNarrative(false)
                setNarrativeChoice(id ?? NONE_VALUE)
              }}
            />
          )}
        </>
      )}

      <div className="flex items-start gap-2">
        <Checkbox
          id="includeInResumeBook"
          name="includeInResumeBook"
          value="on"
          defaultChecked={resumeBookOptIn}
        />
        <Label htmlFor="includeInResumeBook" className="font-normal">
          Include my resume in the Resume Book, so recruiters and hiring managers can find it.
          You can change this any time in Privacy Settings.
        </Label>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending || !hasFile} variant={hasFile ? 'success' : 'secondary'}>
        {pending ? 'Uploading and analyzing…' : 'Upload resume'}
      </Button>
      {pending && <InlineLoadingState label="This takes a few seconds — analyzing your resume…" />}
    </form>
  )
}
