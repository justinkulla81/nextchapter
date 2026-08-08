import { emailStyles } from '@/lib/email/email-styles'

interface AdminNewCandidateAccountEmailProps {
  candidateName: string
  signupIp: string | null
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

// Fired once per new CandidateProfile row (including anonymous
// pre-registration profiles, since that's the earliest point a bot-farm
// signal is visible) — never re-sent for the same profile.
export default function AdminNewCandidateAccountEmail({
  candidateName,
  signupIp,
  adminUrl,
}: AdminNewCandidateAccountEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter Admin</p>
      <p>New candidate account: {candidateName}</p>
      <p style={emailStyles.muted}>Signup IP: {signupIp ?? 'unknown'}</p>
      <a href={adminUrl} style={button}>
        View candidate →
      </a>
    </div>
  )
}
