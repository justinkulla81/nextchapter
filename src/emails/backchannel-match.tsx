import { emailStyles } from '@/lib/email/email-styles'

interface BackchannelMatchEmailProps {
  firstName: string | null
  companyName: string
  contactNames: string[]
  networkUrl: string
  unsubscribeUrl: string
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
  marginTop: '16px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function BackchannelMatchEmail({
  firstName,
  companyName,
  contactNames,
  networkUrl,
  unsubscribeUrl,
}: BackchannelMatchEmailProps) {
  const namesText = contactNames.join(', ')

  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>
        You know someone at {companyName}.
      </p>
      <p>
        {firstName ? `Hi ${firstName}, ` : ''}
        you applied to {companyName}, and {namesText} {contactNames.length === 1 ? 'is' : 'are'}{' '}
        already in your networking list.
      </p>
      <p>
        A referral or a quick heads-up from someone inside a company puts your application in
        front of a real person instead of sitting in a queue with hundreds of others —
        it&apos;s one of the highest-leverage things you can do for an application you&apos;ve
        already sent. A short message like &quot;I just applied for the [role] — would you mind
        mentioning it to the hiring manager?&quot; is usually all it takes.
      </p>
      <a href={networkUrl} style={button}>
        See who you know →
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn off these emails
        </a>
      </p>
    </div>
  )
}
