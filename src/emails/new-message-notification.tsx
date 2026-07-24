import { emailStyles } from '@/lib/email/email-styles'

interface NewMessageNotificationEmailProps {
  recipientFirstName: string | null
  senderName: string
  threadUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '16px',
  padding: '12px 20px',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
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
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ marginTop: '16px' }}>Hi {recipientFirstName || 'there'},</p>
      <p>
        <strong>{senderName}</strong> sent you a new message on NextChapter.
      </p>
      <a href={threadUrl} style={button}>
        View message
      </a>
      <p style={footer}>You&apos;re receiving this because you have an active conversation on NextChapter.</p>
    </div>
  )
}
