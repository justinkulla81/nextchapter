import { emailStyles } from '@/lib/email/email-styles'

interface EmployerSeatInviteEmailProps {
  companyName: string
  inviterName: string | null
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

export default function EmployerSeatInviteEmail({ companyName, inviterName, acceptUrl }: EmployerSeatInviteEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi there,</p>
      <p>
        {inviterName || 'A teammate'} invited you to join <strong>{companyName}</strong>&apos;s hiring team on
        NextChapter. You&apos;ll get access to the same roles, candidates, and hiring analytics.
      </p>
      <a href={acceptUrl} style={button}>
        Accept invite →
      </a>
      <p style={footer}>If you weren&apos;t expecting this, you can ignore this email.</p>
    </div>
  )
}
