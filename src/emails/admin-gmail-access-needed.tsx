import { emailStyles } from '@/lib/email/email-styles'

interface AdminGmailAccessNeededEmailProps {
  candidateName: string
  candidateEmail: string
  adminUrl: string
  googleConsoleUrl: string
  allowlistUrl: string
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
  marginRight: '12px',
  padding: '12px 20px',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}

const secondaryButton: React.CSSProperties = {
  ...button,
  backgroundColor: '#0b2545',
}

// Fired once per candidate, the first time they hit the Gmail/Calendar OAuth
// hard gate while our app is still in Google's unverified testing mode
// (isGmailTrackingTester). Two separate admin actions are required before
// the candidate can retry successfully: adding their email as a Google
// Cloud Console test user (no API for this — must be done in the Console
// UI), and flipping gmailTrackingTesterEnabled for them on our own
// allow-list page. See notifyAdminGmailAccessNeeded in gmail-oauth.ts.
export default function AdminGmailAccessNeededEmail({
  candidateName,
  candidateEmail,
  adminUrl,
  googleConsoleUrl,
  allowlistUrl,
}: AdminGmailAccessNeededEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter Admin</p>
      <p>
        {candidateName} ({candidateEmail}) just tried to connect Gmail/Calendar and isn&apos;t on the
        Google test-user list yet.
      </p>
      <p style={emailStyles.muted}>
        Two steps to unblock them: add {candidateEmail} as a test user in Google Cloud Console, then
        flip them on in our own allow-list.
      </p>
      <a href={googleConsoleUrl} style={button}>
        Add as Google test user →
      </a>
      <a href={allowlistUrl} style={secondaryButton}>
        Approve on allow-list →
      </a>
      <p>
        <a href={adminUrl}>View candidate →</a>
      </p>
    </div>
  )
}
