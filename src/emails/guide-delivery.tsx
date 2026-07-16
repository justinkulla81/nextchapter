import { emailStyles } from '@/lib/email/email-styles'

interface GuideDeliveryEmailProps {
  firstName: string | null
  guideTitle: string
  downloadUrl: string
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

export default function GuideDeliveryEmail({ firstName, guideTitle, downloadUrl }: GuideDeliveryEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {firstName || 'there'},</p>
      <p>
        Here&apos;s your copy of <strong>{guideTitle}</strong>.
      </p>
      <a href={downloadUrl} style={button}>
        Download the guide →
      </a>
      <p style={footer}>
        We&apos;ll also send occasional NextChapter updates. Unsubscribe anytime.
      </p>
    </div>
  )
}
