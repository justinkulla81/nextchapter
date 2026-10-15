'use client'

import { useActionState, useRef, useTransition, type FormEvent } from 'react'

/**
 * Runs a server action from a form WITHOUT letting React reset the form afterwards.
 *
 * React 19 resets an uncontrolled form to its default values every time a `<form action>` finishes,
 * success or failure. When the action fails validation that wipes out what the person typed, which
 * the design principles forbid ("preserve user input on error"). Submitting through `onSubmit`
 * instead leaves the fields exactly as they were. On success the caller can ask for a reset.
 */
export function usePreservedFormAction<S extends { error?: string }>(
  action: (prev: S | undefined, formData: FormData) => Promise<S | undefined>,
  options: { resetOnSuccess?: boolean } = {}
) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, run, pending] = useActionState(async (prev: S | undefined, formData: FormData): Promise<S | undefined> => {
    const result = await action(prev, formData)
    if (options.resetOnSuccess && !result?.error) formRef.current?.reset()
    return result
  }, undefined)
  const [, startTransition] = useTransition()

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => run(formData))
  }

  return { state, pending, formRef, onSubmit }
}
