import { emailStyles } from '@/lib/email/email-styles'

interface PortfolioAccessRequestEmailProps {
  firstName: string | null
  recruiterName: string
  recruiterFirm: string | null
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

export default function PortfolioAccessRequestEmail({
  firstName,
  recruiterName,
  recruiterFirm,
}: PortfolioAccessRequestEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {firstName || 'there'},</p>
      <p>
        <strong>{recruiterName}</strong>
        {recruiterFirm ? ` at ${recruiterFirm}` : ''} would like to see your Portfolio — your work
        samples and narrative. They can already see your Executive Dossier and resume; this is one
        step more personal, so it&apos;s your call.
      </p>
      <a href="https://launchyournextchapter.com/dashboard" style={button}>
        Review on your dashboard →
      </a>
      <p style={footer}>You control this. Approving lets them view your work samples and narrative.</p>
    </div>
  )
}
