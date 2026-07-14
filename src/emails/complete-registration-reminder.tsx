interface CompleteRegistrationReminderEmailProps {
  firstName: string | null
  gradeDescription: string
  magicLink: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
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
  fontWeight: 600,
  marginTop: '16px',
}

const footer: React.CSSProperties = {
  color: '#4a5568',
  fontSize: '13px',
  marginTop: '32px',
}

export default function CompleteRegistrationReminderEmail({
  firstName,
  gradeDescription,
  magicLink,
  unsubscribeUrl,
}: CompleteRegistrationReminderEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {firstName || 'there'},</p>
      <p>
        You built your NextChapter profile and got an honest read on where you stand: {gradeDescription}.
      </p>
      <p>
        But you never finished creating your account, so your full report (strengths, gaps, and a
        7-day action plan) is still locked.
      </p>
      <p>Click below to pick up exactly where you left off — no password needed.</p>
      <a href={magicLink} style={button}>
        Finish creating my account
      </a>
      <p style={footer}>
        Didn&apos;t mean to start this? You can{' '}
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          stop these reminders
        </a>{' '}
        at any time.
      </p>
    </div>
  )
}
