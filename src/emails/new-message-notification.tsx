import { Button, Card, CardEmail, Headline, Lead, Wordmark } from '@/lib/email/card-layout'

interface NewMessageNotificationEmailProps {
  recipientFirstName: string | null
  senderName: string
  threadUrl: string
}

// Deliberately never quotes the message body — this is a notification that
// something arrived, not a copy of it, and there's no reply-to shortcut
// around the app (see src/lib/messaging/threads.ts privacy invariants).
export default function NewMessageNotificationEmail({
  recipientFirstName,
  senderName,
  threadUrl,
}: NewMessageNotificationEmailProps) {
  return (
    <CardEmail
      preheader={`${senderName} sent you a new message on NextChapter.`}
      audience="candidate"
      footer={<>You&apos;re receiving this because you have an active conversation on NextChapter.</>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{senderName} sent you a new message on NextChapter</Headline>
        <Lead>Hi {recipientFirstName || 'there'},</Lead>
        <Button href={threadUrl}>View message</Button>
      </Card>
    </CardEmail>
  )
}
