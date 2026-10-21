import { cn } from '@/lib/utils'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import type { MessageSenderRole } from '@prisma/client'

interface MessageBubblesProps {
  messages: { id: string; senderRole: MessageSenderRole; body: string; createdAt: Date }[]
  selfRole: MessageSenderRole
  partnerName: string
  partnerAvatarUrl?: string | null
  /** The redesigned look: message text at body size and dates no smaller than 12px. */
  redesign?: boolean
}

export function MessageBubbles({ messages, selfRole, partnerName, partnerAvatarUrl, redesign = false }: MessageBubblesProps) {
  if (messages.length === 0) {
    return <p className={cn('p-4 text-muted-foreground', redesign ? 'text-base' : 'text-sm')}>No messages yet — say hello.</p>
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((message) => {
        const isSelf = message.senderRole === selfRole
        // Never attributed to whichever partner the thread belongs to — an
        // admin-support message shown with the coach/recruiter/employer's
        // own name/avatar would misrepresent who actually sent it (see
        // MessageSenderRole.ADMIN's own schema comment).
        const isAdmin = message.senderRole === 'ADMIN'
        const bubbleName = isAdmin ? 'NextChapter Support' : partnerName
        const bubbleAvatarUrl = isAdmin ? null : partnerAvatarUrl
        return (
          <div key={message.id} className={cn('flex items-end gap-2', isSelf ? 'justify-end' : 'justify-start')}>
            {!isSelf && <AvatarDisplay name={bubbleName} url={bubbleAvatarUrl} size={redesign ? 32 : 24} />}
            <div className="max-w-[75%] space-y-0.5">
              {isAdmin && <p className={cn('font-medium text-muted-foreground', redesign ? 'text-xs' : 'text-[10px]')}>NextChapter Support</p>}
              <div
                className={cn(
                  'px-3 py-2 whitespace-pre-wrap',
                  redesign ? 'rounded-2xl text-base' : 'rounded-lg text-sm',
                  isSelf ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                )}
              >
                {message.body}
                <p className={cn('mt-1', redesign ? 'text-xs' : 'text-[10px]', isSelf ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                  {message.createdAt.toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
