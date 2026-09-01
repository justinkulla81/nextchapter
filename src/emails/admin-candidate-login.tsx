import { emailStyles } from '@/lib/email/email-styles'

interface AdminCandidateLoginEmailProps {
  candidateName: string
  candidateEmail: string
  ip: string | null
  loggedInAt: string
  adminUrl: string
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

const row: React.CSSProperties = {
  margin: '4px 0',
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

// Fired once per real login (recordCandidateLoginIfDue's own 30-minute
// dedupe window — see record-login.ts), not once per page load.
export default function AdminCandidateLoginEmail({
  candidateName,
  candidateEmail,
  ip,
  loggedInAt,
  adminUrl,
}: AdminCandidateLoginEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter Admin</p>
      <p>{candidateName} logged in</p>
      <p style={row}>Email: {candidateEmail}</p>
      <p style={row}>Time: {loggedInAt}</p>
      <p style={{ ...emailStyles.muted, marginTop: '12px' }}>IP: {ip ?? 'unknown'}</p>
      <a href={adminUrl} style={button}>
        View candidate →
      </a>
    </div>
  )
}
