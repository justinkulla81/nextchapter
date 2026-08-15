import { emailStyles } from '@/lib/email/email-styles'

interface OutplacementSeatInviteEmailProps {
  orgName: string
  acceptUrl: string
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

// Sent when an employer_admin enrolls someone who has no existing
// NextChapter account — same "admin-generated, pre-confirmed magic link"
// shape as CoachClientInviteEmail. Deliberately does not name the employer
// contact who did the enrolling (the recipient already knows — their own
// HR department told them this benefit was coming) and does not put
// anything about the org's internal contract/tier details in the email
// body, which would have no reason to leave the org side.
export default function OutplacementSeatInviteEmail({ orgName, acceptUrl }: OutplacementSeatInviteEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi there,</p>
      <p>
        {orgName} has set up a NextChapter outplacement benefit for you. NextChapter is a job-search platform
        with resume tools, coaching, a market-difficulty report, and a recruiter network — everything below is
        private to you. {orgName} never sees your individual activity, only anonymous, aggregate participation
        numbers across everyone enrolled.
      </p>
      <a href={acceptUrl} style={button}>
        Set up your account →
      </a>
      <p style={footer}>If you weren&apos;t expecting this, you can ignore this email.</p>
    </div>
  )
}
