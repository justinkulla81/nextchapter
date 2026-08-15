import { emailStyles } from '@/lib/email/email-styles'

interface OutplacementOrgInviteEmailProps {
  orgName: string
  roleLabel: string
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

// Sent to a new NextChapter for Employers portal user (admin/viewer/
// legal/finance) — either the primary contact NextChapter admin sets up
// when a contract is created, or a teammate an existing employer_admin
// invites.
export default function OutplacementOrgInviteEmail({ orgName, roleLabel, acceptUrl }: OutplacementOrgInviteEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter for Employers</p>
      <p>Hi there,</p>
      <p>
        You&apos;ve been added to {orgName}&apos;s NextChapter for Employers account as {roleLabel}. Set up your
        account to get started.
      </p>
      <a href={acceptUrl} style={button}>
        Set up your account →
      </a>
      <p style={footer}>If you weren&apos;t expecting this, you can ignore this email.</p>
    </div>
  )
}
