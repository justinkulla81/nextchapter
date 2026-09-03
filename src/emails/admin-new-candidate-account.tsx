import { emailStyles } from '@/lib/email/email-styles'

interface AdminNewCandidateAccountEmailProps {
  candidateName: string
  candidateEmail: string
  recentCompany: string | null
  situation: string | null
  location: string | null
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

const secondaryButton: React.CSSProperties = {
  ...button,
  display: 'block',
  width: 'fit-content',
  backgroundColor: 'transparent',
  color: '#2e7d5b',
  border: '1px solid #2e7d5b',
}

// Adding a candidate as a Gmail/Calendar tester (support/admin/tracking-testers)
// isn't enough on its own while our OAuth app is in Testing mode — Google
// separately requires adding their email as a test user in Cloud Console.
// This link gets the admin there in one click from the same email that
// first tells them a new candidate exists, instead of a second lookup.
const GOOGLE_CONSOLE_TEST_USERS_URL =
  'https://console.cloud.google.com/auth/overview?project=project-0ab98e91-a9ef-4edf-a28'

// Fired once per candidate — the first time firstName/lastName/email are
// all known (see maybeNotifyAdminOfNewCandidate in
// send-admin-new-candidate-account.ts), never re-sent for the same
// candidate. Replaces the old pair of emails that fired at
// profile-creation and resume-upload time, both before any of this was
// known — see IDEAS.md/admin feedback for the "Unnamed" complaint that
// prompted the consolidation.
export default function AdminNewCandidateAccountEmail({
  candidateName,
  candidateEmail,
  recentCompany,
  situation,
  location,
  signupIp,
  adminUrl,
}: AdminNewCandidateAccountEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter Admin</p>
      <p>New candidate: {candidateName}</p>
      <p style={row}>Email: {candidateEmail}</p>
      <p style={row}>Most recent company: {recentCompany ?? 'Unknown'}</p>
      <p style={row}>Situation: {situation ?? 'Unknown'}</p>
      <p style={row}>Location: {location ?? 'Unknown'}</p>
      <p style={{ ...emailStyles.muted, marginTop: '12px' }}>Signup IP: {signupIp ?? 'unknown'}</p>
      <a href={adminUrl} style={button}>
        View candidate →
      </a>
      <a href={GOOGLE_CONSOLE_TEST_USERS_URL} style={secondaryButton}>
        Add as Google test user →
      </a>
    </div>
  )
}
