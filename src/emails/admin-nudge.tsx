import { emailStyles } from '@/lib/email/email-styles'

interface AdminNudgeEmailProps {
  bodyText: string
  ctaLabel: string
  ctaUrl: string
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

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '20px',
  ...emailStyles.cta,
}

// Admin-edited free text — split on blank lines into paragraphs so the
// admin's own line breaks (from the compose textarea) render as real
// paragraphs rather than one run-on block.
export default function AdminNudgeEmail({ bodyText, ctaLabel, ctaUrl }: AdminNudgeEmailProps) {
  const paragraphs = bodyText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      {paragraphs.map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
      <a href={ctaUrl} style={button}>
        {ctaLabel} →
      </a>
    </div>
  )
}
