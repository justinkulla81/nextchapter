import { emailStyles } from '@/lib/email/email-styles'

interface CandidateMatchLine {
  displayName: string
  roleTitle: string
  matchLabel: string
  locked: boolean
}

interface MarketDigestEmployerEmailProps {
  contactName: string | null
  companyName: string
  matchLines: CandidateMatchLine[]
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

export default function MarketDigestEmployerEmail({
  contactName,
  companyName,
  matchLines,
  nuggetTitle,
  nuggetUrl,
  nuggetSummary,
  portalUrl,
  unsubscribeUrl,
}: MarketDigestEmployerEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {contactName || `the ${companyName} team`},</p>
      {matchLines.length > 0 && (
        <>
          <p>Here&apos;s who&apos;s a match for what you&apos;re hiring this week.</p>
          <ul>
            {matchLines.map((m, i) => (
              <li key={`${m.roleTitle}-${i}`}>
                {m.locked ? m.displayName : <strong>{m.displayName}</strong>} — {m.matchLabel} for {m.roleTitle}
              </li>
            ))}
          </ul>
        </>
      )}
      {nuggetTitle && nuggetUrl && (
        <p>
          <strong>Worth a read:</strong> <a href={nuggetUrl}>{nuggetTitle}</a>
          {nuggetSummary && ` — ${nuggetSummary}`}
        </p>
      )}
      <a href={portalUrl} style={button}>
        See your matches →
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl}>Unsubscribe from the Weekly Market Digest</a>
      </p>
    </div>
  )
}
