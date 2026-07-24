import { cn } from '@/lib/utils'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import type { MessageSenderRole } from '@prisma/client'

interface MessageBubblesProps {
  messages: { id: string; senderRole: MessageSenderRole; body: string; createdAt: Date }[]
  selfRole: MessageSenderRole
  partnerName: string
  partnerAvatarUrl?: string | null
}

export function MessageBubbles({ messages, selfRole, partnerName, partnerAvatarUrl }: MessageBubblesProps) {
  if (messages.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No messages yet — say hello.</p>
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((message) => {
        const isSelf = message.senderRole === selfRole
        return (
          <div key={message.id} className={cn('flex items-end gap-2', isSelf ? 'justify-end' : 'justify-start')}>
            {!isSelf && <AvatarDisplay name={partnerName} url={partnerAvatarUrl} size={24} />}
            <div
              className={cn(
                'max-w-[75%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
                isSelf ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
              )}
            >
              {message.body}
              <p className={cn('mt-1 text-[10px]', isSelf ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                {message.createdAt.toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
