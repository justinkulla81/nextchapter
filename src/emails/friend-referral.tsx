import { emailStyles } from '@/lib/email/email-styles'

interface FriendReferralEmailProps {
  referrerEmail: string
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

export default function FriendReferralEmail({ referrerEmail }: FriendReferralEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi there,</p>
      <p>
        {referrerEmail} thought of you and wanted to pass along NextChapter — a platform for people
        between chapters of their career. It gives you an honest read on where you stand and a real
        weekly plan, not just another job board.
      </p>
      <p>It&apos;s free for candidates, always.</p>
      <a href="https://launchyournextchapter.com" style={button}>
        Take a look
      </a>
      <p style={footer}>
        If you weren&apos;t expecting this, you can safely ignore it — no account was created and
        nothing else will be sent.
      </p>
    </div>
  )
}
