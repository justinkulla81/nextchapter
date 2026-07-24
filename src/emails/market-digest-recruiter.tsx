import { emailStyles } from '@/lib/email/email-styles'

interface MarketDigestRecruiterEmailProps {
  fullName: string
  specialty: string | null
  adzunaCount: number | null
  blsYoyChangePct: number | null
  nuggetTitle: string | null
  nuggetUrl: string | null
  nuggetSummary: string | null
  portalUrl: string
  unsubscribeUrl: string
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

export default function MarketDigestRecruiterEmail({
  fullName,
  specialty,
  adzunaCount,
  blsYoyChangePct,
  nuggetTitle,
  nuggetUrl,
  nuggetSummary,
  portalUrl,
  unsubscribeUrl,
}: MarketDigestRecruiterEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {fullName.split(' ')[0]},</p>
      <p>Here&apos;s this week&apos;s market read for {specialty || 'your specialty'}.</p>
      {adzunaCount !== null && (
        <p>
          <strong>{adzunaCount.toLocaleString()}</strong> open roles currently match this specialty.
        </p>
      )}
      {blsYoyChangePct !== null && (
        <p>
          Employment in this field is {blsYoyChangePct >= 0 ? 'up' : 'down'}{' '}
          <strong>{Math.abs(blsYoyChangePct).toFixed(1)}%</strong> year over year.
        </p>
      )}
      {nuggetTitle && nuggetUrl && (
        <p>
          <strong>Worth a read:</strong> <a href={nuggetUrl}>{nuggetTitle}</a>
          {nuggetSummary && ` — ${nuggetSummary}`}
        </p>
      )}
      <a href={portalUrl} style={button}>
        Go to your dashboard →
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl}>Unsubscribe from the Weekly Market Digest</a>
      </p>
    </div>
  )
}
