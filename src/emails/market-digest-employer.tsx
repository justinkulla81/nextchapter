import { emailStyles } from '@/lib/email/email-styles'

interface RoleMarketLine {
  roleTitle: string
  adzunaCount: number | null
}

interface MarketDigestEmployerEmailProps {
  contactName: string | null
  companyName: string
  roleLines: RoleMarketLine[]
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
  roleLines,
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
      <p>Here&apos;s this week&apos;s market read for the roles you&apos;re hiring.</p>
      {roleLines.length > 0 && (
        <ul>
          {roleLines.map((r) => (
            <li key={r.roleTitle}>
              {r.roleTitle}
              {r.adzunaCount !== null && ` — ${r.adzunaCount.toLocaleString()} comparable open roles`}
            </li>
          ))}
        </ul>
      )}
      {nuggetTitle && nuggetUrl && (
        <p>
          <strong>Worth a read:</strong> <a href={nuggetUrl}>{nuggetTitle}</a>
          {nuggetSummary && ` — ${nuggetSummary}`}
        </p>
      )}
      <a href={portalUrl} style={button}>
        Go to your roles →
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl}>Unsubscribe from the Weekly Market Digest</a>
      </p>
    </div>
  )
}
