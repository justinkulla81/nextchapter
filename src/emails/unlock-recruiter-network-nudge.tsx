import { emailStyles } from '@/lib/email/email-styles'

interface UnlockRecruiterNetworkNudgeEmailProps {
  firstName: string | null
  privacyUrl: string
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

// Sent to A-grade candidates who haven't opted into the Recruiter Database
// yet — framed around the benefit to them (recruiters looking at them),
// not "so we can show you to recruiters." Reused by both the weekly cron
// (lockedAGrade bucket) and the admin's manual "Nudge to unlock" button.
export default function UnlockRecruiterNetworkNudgeEmail({
  firstName,
  privacyUrl,
  unsubscribeUrl,
}: UnlockRecruiterNetworkNudgeEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {firstName || 'there'},</p>
      <p>
        Your Current Market Reality just hit an A — that puts you in range for the Recruiter Database, where vetted
        recruiters browse for candidates who&apos;ve already proven real search execution.
      </p>
      <p>You haven&apos;t opted in yet. It&apos;s one toggle on your Privacy page, and you can turn it back off anytime.</p>
      <a href={privacyUrl} style={button}>
        Turn on Recruiter Database →
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl}>Unsubscribe from these nudges</a>
      </p>
    </div>
  )
}
