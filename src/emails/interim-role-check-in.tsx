import { emailStyles } from '@/lib/email/email-styles'

interface InterimRoleCheckInEmailProps {
  firstName: string | null
  companyName: string | null
  stillActiveUrl: string
  endedUrl: string
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

const buttonRow: React.CSSProperties = {
  marginTop: '20px',
  display: 'flex',
  gap: '12px',
}

const primaryButton: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  ...emailStyles.cta,
}

const secondaryButton: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#f2f2f2',
  color: '#0a0a0a',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  ...emailStyles.cta,
}

export default function InterimRoleCheckInEmail({
  firstName,
  companyName,
  stillActiveUrl,
  endedUrl,
}: InterimRoleCheckInEmailProps) {
  const roleLabel = companyName ? `at ${companyName}` : 'your interim work'

  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>
        {firstName ? `Hi ${firstName} — ` : ''}still doing {roleLabel}?
      </p>
      <p>
        Quick check so your resume and Dossier stay accurate — nothing else to do here beyond
        picking one of these.
      </p>
      <div style={buttonRow}>
        <a href={stillActiveUrl} style={primaryButton}>
          Yes, still active
        </a>
        <a href={endedUrl} style={secondaryButton}>
          No, it&apos;s ended
        </a>
      </div>
    </div>
  )
}
