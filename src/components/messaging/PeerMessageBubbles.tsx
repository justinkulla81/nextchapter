import { FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AvatarDisplay } from '@/components/ui/avatar-display'

// Community DM variant of MessageBubbles — both sides carry senderRole
// CANDIDATE, so bubble side is decided by senderCandidateId instead.
interface PeerMessageBubblesProps {
  messages: {
    id: string
    senderCandidateId: string | null
    body: string
    createdAt: Date
    attachedResume?: { id: string; label: string | null; fileName: string; filePath: string } | null
  }[]
  selfCandidateId: string
  partnerName: string
  partnerAvatarUrl?: string | null
  // Signed URL per attached resume's storage path — resolved once by the
  // parent for the whole thread rather than per-bubble (see community/page.tsx).
  attachmentUrls?: Map<string, string | null>
}

export function PeerMessageBubbles({
  messages,
  selfCandidateId,
  partnerName,
  partnerAvatarUrl,
  attachmentUrls,
}: PeerMessageBubblesProps) {
  if (messages.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No messages yet — say hello.</p>
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((message) => {
        const isSelf = message.senderCandidateId === selfCandidateId
        const attachmentUrl = message.attachedResume ? attachmentUrls?.get(message.attachedResume.filePath) : null
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
              {message.attachedResume && (
                <div
                  className={cn(
                    'mt-2 flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs',
                    isSelf ? 'border-primary-foreground/30' : 'border-border'
                  )}
                >
                  <FileText className="size-3.5 shrink-0" aria-hidden />
                  {attachmentUrl ? (
                    <a
                      href={attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate underline underline-offset-4"
                    >
                      {message.attachedResume.label || message.attachedResume.fileName}
                    </a>
                  ) : (
                    <span className="truncate">{message.attachedResume.label || message.attachedResume.fileName}</span>
                  )}
                </div>
              )}
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
