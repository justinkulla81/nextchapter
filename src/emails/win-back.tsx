import { emailStyles } from '@/lib/email/email-styles'
import type { WinBackContent } from '@/lib/winback/sequence'
import { AudienceTag } from '@/lib/email/audience-tag'

interface WinBackEmailProps {
  content: WinBackContent
  ctaUrl: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
  fontSize: '15px',
}

const button: React.CSSProperties = {
  display: 'block',
  textAlign: 'center',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '24px',
  backgroundColor: '#1d4e89',
  color: '#ffffff',
  ...emailStyles.cta,
}

// Sent to members who have gone quiet, up to three times (src/lib/winback).
export default function WinBackEmail({ content, ctaUrl, unsubscribeUrl }: WinBackEmailProps) {
  return (
    <div style={container}>
      <p style={{ fontSize: '20px', fontWeight: 700, color: '#0b2545' }}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>{content.heading}</p>
      {content.body.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <a href={ctaUrl} style={button}>
        {content.cta}
      </a>
      {content.closing && <p style={{ marginTop: '24px' }}>{content.closing}</p>}
      <p style={{ marginTop: '32px', ...emailStyles.muted }}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn off these emails
        </a>
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
