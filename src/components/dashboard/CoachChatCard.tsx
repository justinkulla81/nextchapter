'use client'

import { useActionState, useOptimistic, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
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
  suggestedQuestions,
  showExecutiveCoachCta,
}: {
  initialMessages: CoachMessageItem[]
  // Shown as clickable chips above the input, only before the candidate has
  // sent their own first message — a light nudge for someone seeing this
  // chat for the first time (e.g. on the Coaching page), not a permanent
  // fixture once they're actually mid-conversation.
  suggestedQuestions?: string[]
  // Folds the former standalone "Want a real human in your corner too?"
  // card into Victoria's own box as a small footer instead of a second,
  // adjacent card making the same "here's a coach option" point twice.
  showExecutiveCoachCta?: boolean
}) {
  const [state, formAction, pending] = useActionState(sendCoachMessage, undefined)
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [content, setContent] = useState('')
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    initialMessages,
    (current: CoachMessageItem[], newMessage: CoachMessageItem) => [...current, newMessage]
  )
  const hasSentMessage = optimisticMessages.some((m) => m.role === 'user')

  async function handleAction(formData: FormData) {
    const submitted = (formData.get('content') as string | null)?.trim()
    if (submitted) {
      addOptimisticMessage({ id: `optimistic-${Date.now()}`, role: 'user', content: submitted })
    }
    setContent('')
    formRef.current?.reset()
    await formAction(formData)
  }

  function selectSuggestion(question: string) {
    setContent(question)
    inputRef.current?.focus()
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
                  m.role === 'user' ? 'bg-navy text-white' : 'bg-muted'
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

        {suggestedQuestions && suggestedQuestions.length > 0 && !hasSentMessage && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Try asking her:</p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => selectSuggestion(question)}
                  className="rounded-full border border-border bg-white px-3 py-1 text-left text-xs text-foreground transition-colors hover:border-brand/40 hover:text-brand"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        <form
          ref={formRef}
          action={handleAction}
          className={cn('flex gap-2', pending && 'cursor-progress [&_*]:cursor-progress')}
        >
          <Input
            ref={inputRef}
            name="content"
            placeholder="Type a message…"
            autoComplete="off"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button type="submit" disabled={pending}>
            Send
          </Button>
        </form>
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

        {showExecutiveCoachCta && (
          <div className="flex flex-col items-start gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              <span className="mr-1.5 shrink-0 rounded-full bg-orange/20 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-orange uppercase">
                Premium
              </span>
              Want a more personalized, executive experience? Executive Coach adds a human career
              coach on top of Victoria — mock interviews, resume review, a second opinion on hard
              calls.
            </p>
            <Button nativeButton={false} render={<Link href="/coaching" />} size="sm" variant="success" className="shrink-0">
              Get a human executive coach
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
