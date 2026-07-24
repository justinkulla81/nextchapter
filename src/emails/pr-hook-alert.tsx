import { emailStyles } from '@/lib/email/email-styles'

interface PrHookAlertEmailProps {
  title: string | null
  url: string
  summary: string | null
  suggestedAction: string | null
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

const badge: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  backgroundColor: '#b3261e',
  color: '#ffffff',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
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

export default function PrHookAlertEmail({ title, url, summary, suggestedAction }: PrHookAlertEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={badge}>PR / media hook</p>
      <p style={{ marginTop: '16px', fontWeight: 600 }}>{title || url}</p>
      {summary && <p>{summary}</p>}
      {suggestedAction && (
        <p>
          <strong>Suggested angle:</strong> {suggestedAction}
        </p>
      )}
      <a href={url} style={button}>
        Read the source →
      </a>
      <p style={footer}>
        Flagged by the Research Library as high-priority — this does not wait for the weekly digest.
      </p>
    </div>
  )
}
