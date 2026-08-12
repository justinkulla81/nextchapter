import { cn } from '@/lib/utils'
import { AvatarDisplay } from '@/components/ui/avatar-display'

// Community DM variant of MessageBubbles — both sides carry senderRole
// CANDIDATE, so bubble side is decided by senderCandidateId instead.
interface PeerMessageBubblesProps {
  messages: { id: string; senderCandidateId: string | null; body: string; createdAt: Date }[]
  selfCandidateId: string
  partnerName: string
  partnerAvatarUrl?: string | null
}

export function PeerMessageBubbles({ messages, selfCandidateId, partnerName, partnerAvatarUrl }: PeerMessageBubblesProps) {
  if (messages.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No messages yet — say hello.</p>
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((message) => {
        const isSelf = message.senderCandidateId === selfCandidateId
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
