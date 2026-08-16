import { emailStyles } from '@/lib/email/email-styles'

interface MarketRealityReportEmailProps {
  candidateName: string
  reportUrl: string
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

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '20px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function MarketRealityReportEmail({ candidateName, reportUrl }: MarketRealityReportEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {candidateName},</p>
      <p>We have your Market Reality Grade.</p>
      <p>Find out how employers will actually read your resume — what&apos;s working, what to fix first.</p>
      <a href={reportUrl} style={button}>
        See your grade
      </a>
      <p style={footer}>This report is only visible to you — never shared with employers.</p>
    </div>
  )
}
