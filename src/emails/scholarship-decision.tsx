import { emailStyles } from '@/lib/email/email-styles'

interface ScholarshipDecisionEmailProps {
  firstName: string | null
  approved: boolean
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
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '16px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function ScholarshipDecisionEmail({ firstName, approved }: ScholarshipDecisionEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {firstName || 'there'},</p>
      {approved ? (
        <>
          <p>
            Thanks for sharing what you did — we&apos;ve approved your scholarship application for reduced or
            free access to Coaching Premium.
          </p>
          <p>Our team will reach out shortly to get you set up.</p>
          <a href="https://launchyournextchapter.com/dashboard/plans" style={button}>
            View your plans
          </a>
        </>
      ) : (
        <>
          <p>
            Thanks for sharing what you did. We weren&apos;t able to approve this application right now, but
            circumstances change — you&apos;re welcome to apply again anytime.
          </p>
          <p>
            In the meantime, the free core of NextChapter — your Market Reality Report, Resume Studio, job
            matching, and community — stays fully available to you, no cost, no time limit.
          </p>
        </>
      )}
      <p style={footer}>
        If you have questions, just reply to this email — a real person reads every response.
      </p>
    </div>
  )
}
