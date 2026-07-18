'use client'

import { useActionState, useOptimistic, useRef } from 'react'
import Image from 'next/image'
import { UserRound } from 'lucide-react'
import { sendCoachMessage } from '@/app/dashboard/coach/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Filename carries a version suffix (bump it on future photo swaps) — Next's
// image optimizer rejects a query string on a local src (400s), and caches
// by URL rather than file content, so reusing the old filename after a
// redeploy would keep serving the stale cached crop.
const VICTORIA_PHOTO_PATH = '/marketing/victoria-headshot-v4.jpg'
const HAS_VICTORIA_PHOTO = true

interface CoachMessageItem {
  id: string
  role: string
  content: string
}

export function CoachChatCard({
  initialMessages,
  firstName,
}: {
  initialMessages: CoachMessageItem[]
  firstName: string | null
}) {
  const [state, formAction, pending] = useActionState(sendCoachMessage, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    initialMessages,
    (current: CoachMessageItem[], newMessage: CoachMessageItem) => [...current, newMessage]
  )

  async function handleAction(formData: FormData) {
    const content = (formData.get('content') as string | null)?.trim()
    if (content) {
      addOptimisticMessage({ id: `optimistic-${Date.now()}`, role: 'user', content })
    }
    formRef.current?.reset()
    await formAction(formData)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand/10 text-brand">
            {HAS_VICTORIA_PHOTO ? (
              <Image src={VICTORIA_PHOTO_PATH} alt="Victoria" width={40} height={40} className="size-10 object-cover" />
            ) : (
              <UserRound aria-hidden className="size-5" />
            )}
          </span>
          <div>
            <CardTitle className="text-sm font-medium text-foreground">
              Hi, I&apos;m Victoria, Your Executive Coach
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {firstName ? `${firstName}, ` : ''}How can I help you with your search?
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {optimisticMessages.map((m) => (
            <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                  m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {pending && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                Victoria is thinking…
              </div>
            </div>
          )}
        </div>

        <form
          ref={formRef}
          action={handleAction}
          className={cn('flex gap-2', pending && 'cursor-progress [&_*]:cursor-progress')}
        >
          <Input name="content" placeholder="Type a message…" autoComplete="off" />
          <Button type="submit" disabled={pending}>
            Send
          </Button>
        </form>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  )
}
