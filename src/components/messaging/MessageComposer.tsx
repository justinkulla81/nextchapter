'use client'

import { useActionState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'

type SendMessageState = { error?: string } | undefined

export function MessageComposer({
  threadId,
  action,
}: {
  threadId: string
  action: (prevState: SendMessageState, formData: FormData) => Promise<SendMessageState>
}) {
  const [state, formAction] = useActionState(action, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  const wasSubmitting = useRef(false)

  useEffect(() => {
    if (wasSubmitting.current && !state?.error) {
      formRef.current?.reset()
    }
    wasSubmitting.current = false
  }, [state])

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
      <div className="flex items-center justify-between gap-3">
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <SubmitButton pendingLabel="Sending…" className="ml-auto">
          Send
        </SubmitButton>
      </div>
    </form>
  )
}
