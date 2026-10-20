'use client'

import { useActionState, useRef, useEffect, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChoiceField } from '@/components/candidate/ChoiceField'
import { ActionSubmit } from '@/components/candidate/ActionSubmit'

type SendMessageState = { error?: string } | undefined

const NO_ATTACHMENT_VALUE = '__none__'

export function MessageComposer({
  threadId,
  action,
  resumeOptions,
  defaultAttachedResumeId,
  redesign = false,
}: {
  redesign?: boolean
  threadId: string
  action: (prevState: SendMessageState, formData: FormData) => Promise<SendMessageState>
  // Candidate-only — only ever passed by the peer-message composer (never
  // coach/recruiter/employer threads, where "attach one of my resumes"
  // doesn't apply). Omitted entirely, this renders exactly as before.
  resumeOptions?: { id: string; label: string }[]
  // Deep-linked from the resume page's "Send to a contact" action (see
  // ResumeVersionsList) — pre-selects this resume in the picker above,
  // only when it's actually one of resumeOptions.
  defaultAttachedResumeId?: string
}) {
  const [state, formAction] = useActionState(action, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  const wasSubmitting = useRef(false)
  const [attachedResumeId, setAttachedResumeId] = useState(
    defaultAttachedResumeId && resumeOptions?.some((r) => r.id === defaultAttachedResumeId)
      ? defaultAttachedResumeId
      : NO_ATTACHMENT_VALUE
  )

  useEffect(() => {
    if (wasSubmitting.current && !state?.error) {
      formRef.current?.reset()
      setAttachedResumeId(NO_ATTACHMENT_VALUE)
    }
    wasSubmitting.current = false
  }, [state])

  // The redesign: a labelled box, "Attach a résumé" as buttons (or a dropdown past four), and one send action.
  if (redesign) {
    return (
      <form
        ref={formRef}
        action={(formData) => {
          wasSubmitting.current = true
          return formAction(formData)
        }}
        className="space-y-4"
      >
        <input type="hidden" name="threadId" value={threadId} />
        <div className="space-y-2">
          <label htmlFor={`message-${threadId}`} className="block text-base font-semibold text-ink">
            Your message
          </label>
          <Textarea id={`message-${threadId}`} name="body" required rows={3} className="text-base" />
        </div>
        {resumeOptions && resumeOptions.length > 0 && (
          <>
            <ChoiceField
              name="attachedResumeIdChoice"
              label="Attach a résumé"
              options={[{ value: NO_ATTACHMENT_VALUE, label: 'None' }, ...resumeOptions.map((r) => ({ value: r.id, label: r.label }))]}
              value={attachedResumeId}
              onChange={(value) => setAttachedResumeId(value || NO_ATTACHMENT_VALUE)}
            />
            <input type="hidden" name="attachedResumeId" value={attachedResumeId === NO_ATTACHMENT_VALUE ? '' : attachedResumeId} />
          </>
        )}
        {state?.error && (
          <p role="alert" className="text-base text-destructive">
            {state.error}
          </p>
        )}
        <ActionSubmit pendingLabel="Sending…" event="message_sent" props={{ threadId, withResume: attachedResumeId !== NO_ATTACHMENT_VALUE }}>
          Send message
        </ActionSubmit>
      </form>
    )
  }

  return (
    <form
      ref={formRef}
      action={(formData) => {
        wasSubmitting.current = true
        return formAction(formData)
      }}
      className="space-y-2"
    >
      <input type="hidden" name="threadId" value={threadId} />
      <Textarea name="body" required placeholder="Write a message…" rows={3} />
      {resumeOptions && resumeOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <Select
            items={[
              { value: NO_ATTACHMENT_VALUE, label: 'No resume attached' },
              ...resumeOptions.map((r) => ({ value: r.id, label: `Attach: ${r.label}` })),
            ]}
            value={attachedResumeId}
            onValueChange={(value) => setAttachedResumeId(value ?? NO_ATTACHMENT_VALUE)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ATTACHMENT_VALUE}>No resume attached</SelectItem>
              {resumeOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  Attach: {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="attachedResumeId" value={attachedResumeId === NO_ATTACHMENT_VALUE ? '' : attachedResumeId} />
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <SubmitButton pendingLabel="Sending…" className="ml-auto">
          Send
        </SubmitButton>
      </div>
    </form>
  )
}
