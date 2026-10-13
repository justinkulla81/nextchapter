import { emailStyles } from '@/lib/email/email-styles'
import type { ReviewEmailContent } from '@/lib/in-work/outreach'

interface InWorkReviewEmailProps {
  firstName: string | null
  content: ReviewEmailContent
  appUrl: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
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

// Plain by design: no employer name, no job-search wording, nothing that
// looks wrong on a shared or work screen.
export default function InWorkReviewEmail({ firstName, content, appUrl, unsubscribeUrl }: InWorkReviewEmailProps) {
  const base = `${appUrl}/dashboard/in-work`
  return (
    <div style={container}>
      <p style={{ fontSize: '20px', fontWeight: 700, color: '#0b2545' }}>NextChapter</p>
      <p>Hi {firstName || 'there'},</p>
      <p>{content.intro}</p>
      <ol style={{ paddingLeft: '20px', marginTop: '12px' }}>
        {content.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <a href={`${base}${content.ctaQuery}`} style={button}>
        {content.ctaLabel}
      </a>
      {content.secondaryLabel && content.secondaryQuery && (
        <p style={emailStyles.muted}>
          Or <a href={`${base}${content.secondaryQuery}`} style={{ color: '#1d4e89' }}>{content.secondaryLabel.toLowerCase()}</a>.
        </p>
      )}
      <p style={{ marginTop: '32px', ...emailStyles.muted }}>
        This goes only to you. Nothing in your workspace is shared with anyone at work.{' '}
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn these reminders off
        </a>
        .
      </p>
    </div>
  )
}
