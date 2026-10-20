'use client'

import { useActionState } from 'react'
import { updateEmailTopics } from '@/app/dashboard/privacy/actions'
import { EMAIL_TOPICS, type EmailTopicField } from '@/lib/constants/notifications'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function EmailTopicToggles({ optedOut }: { optedOut: Record<EmailTopicField, boolean> }) {
  const [state, formAction, pending] = useActionState(updateEmailTopics, undefined)

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
