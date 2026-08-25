import { emailStyles } from '@/lib/email/email-styles'

interface Week1KickoffEmailProps {
  firstName: string | null
  victoriaName: 'Victoria' | 'Vicki' | 'Vic'
  onboardingComplete: boolean
  actionItems: string[]
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

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const list: React.CSSProperties = {
  paddingLeft: '20px',
  marginTop: '12px',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '24px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function Week1KickoffEmail({
  firstName,
  victoriaName,
  onboardingComplete,
  actionItems,
  appUrl,
  unsubscribeUrl,
}: Week1KickoffEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>
        Hi {firstName || 'there'} — I&apos;m {victoriaName}, your AI coach here at NextChapter.
        I&apos;ll check in with you, help build your plan, and always give it to you straight — but
        I&apos;m completely in your corner. Let&apos;s get started.
      </p>
      <p>
        {onboardingComplete
          ? "Your first week isn't about hitting a points target — it's about making real progress on these:"
          : "Before anything else, let's get your account fully set up — everything I recommend after this gets a lot more useful once these are done:"}
      </p>
      <ul style={list}>
        {actionItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p>
        {onboardingComplete
          ? "Do these, and you'll walk into next week with real material to work from."
          : "Once these are done, I'll have real, personalized next steps ready for you."}
      </p>

      <a href={`${appUrl}/dashboard`} style={button}>
        See my first-week checklist
      </a>

      <p style={footer}>
        Don&apos;t want daily emails?{' '}
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn them off
        </a>
        .
      </p>
    </div>
  )
}
