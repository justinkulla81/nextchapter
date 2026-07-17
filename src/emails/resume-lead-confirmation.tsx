import { emailStyles } from '@/lib/email/email-styles'

interface ResumeLeadConfirmationEmailProps {
  fullName: string
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

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function ResumeLeadConfirmationEmail({ fullName }: ResumeLeadConfirmationEmailProps) {
  const firstName = fullName.split(' ')[0] || 'there'
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {firstName},</p>
      <p>Got your resume — thanks for sending it over.</p>
      <p>
        We review submissions and pass strong matches along to recruiters in our network. There&apos;s
        no guaranteed timeline and not every submission gets forwarded, but if a recruiter wants to
        follow up, they&apos;ll reach out at this email address directly.
      </p>
      <p>
        In the meantime, a free Market Reality Grade and Search Action Grade, plus a personalized
        action plan, is the fastest way to strengthen your search on your own —{' '}
        <a href="https://launchyournextchapter.com/onboarding/resume">get yours here</a>.
      </p>
      <p style={footer}>We&apos;ll also send occasional NextChapter updates. Unsubscribe anytime.</p>
    </div>
  )
}
