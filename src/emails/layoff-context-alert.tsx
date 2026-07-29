import { emailStyles } from '@/lib/email/email-styles'

interface LayoffContextAlertEmailProps {
  submitterName: string
  submitterCompany: string
  submitterEmail: string
  employeeName: string
  employeeEmail: string
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

const badge: React.CSSProperties = {
  display: 'inline-block',
  padding: '4px 10px',
  backgroundColor: '#f4a259',
  color: '#0b2545',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 700,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function LayoffContextAlertEmail({
  submitterName,
  submitterCompany,
  submitterEmail,
  employeeName,
  employeeEmail,
}: LayoffContextAlertEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={badge}>Layoff signal — Give a Reference</p>
      <p style={{ marginTop: '16px', fontWeight: 600 }}>
        {submitterName} at {submitterCompany} just flagged a broader layoff or reduction while
        leaving a reference for {employeeName}.
      </p>
      <p>
        Submitter: {submitterName} ({submitterEmail}) — {submitterCompany}
      </p>
      <p>
        Departing employee: {employeeName} ({employeeEmail})
      </p>
      <p style={footer}>
        This submission was also marked for the outplacement pipeline in Attio. Sent immediately —
        does not wait for the weekly digest.
      </p>
    </div>
  )
}
