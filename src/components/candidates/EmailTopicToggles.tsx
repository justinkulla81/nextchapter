'use client'

import { useActionState } from 'react'
import { updateEmailTopics } from '@/app/dashboard/privacy/actions'
import { EMAIL_TOPICS, type EmailTopicField } from '@/lib/constants/notifications'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function EmailTopicToggles({ optedOut, redesign = false }: { optedOut: Record<EmailTopicField, boolean>; redesign?: boolean }) {
  const [state, formAction, pending] = useActionState(updateEmailTopics, undefined)

  // The redesign: the same checkboxes as a plain list at body size, with one save action.
  if (redesign) {
    return (
      <form action={formAction} className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
        <div>
          <h3 className="text-base font-semibold text-ink">Which emails you get</h3>
          <p className="text-sm text-muted-foreground">Untick anything you do not want. The setting above sets how many; this sets which.</p>
        </div>
        <ul className="space-y-3">
          {EMAIL_TOPICS.map((topic) => (
            <li key={topic.field}>
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" name={topic.field} defaultChecked={!optedOut[topic.field]} className="mt-1.5 size-4" />
                <span>
                  <span className="block text-base font-medium text-ink">{topic.label}</span>
                  <span className="block text-sm text-muted-foreground">{topic.description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {state?.error && (
          <p role="alert" className="text-base text-destructive">
            {state.error}
          </p>
        )}
        <button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted disabled:opacity-70">
          {pending ? 'Saving…' : 'Save email choices'}
        </button>
      </form>
    )
  }

  return (
    <form action={formAction} className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div>
        <h3 className="font-semibold">Choose which emails you get</h3>
        <p className="text-sm text-muted-foreground">
          Untick anything you do not want. This works alongside the setting above: that sets how many, this sets which.
        </p>
      </div>
      <ul className="space-y-3">
        {EMAIL_TOPICS.map((topic) => (
          <li key={topic.field}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                name={topic.field}
                defaultChecked={!optedOut[topic.field]}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="block font-medium">{topic.label}</span>
                <span className="block text-sm text-muted-foreground">{topic.description}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save email choices'}
      </Button>
    </form>
  )
}
