import { emailStyles } from '@/lib/email/email-styles'

interface ReferenceRequestEmailProps {
  candidateName: string
  refereeName: string
  referenceUrl: string
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

export default function ReferenceRequestEmail({
  candidateName,
  refereeName,
  referenceUrl,
}: ReferenceRequestEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {refereeName},</p>
      <p>
        {candidateName} listed you as a reference on NextChapter, a hiring platform for people
        between chapters of their career. They&apos;d appreciate a few minutes of your time to
        share what it was like working together.
      </p>
      <p>It takes about 5 minutes — a handful of ratings and a couple of short written notes.</p>
      <a href={referenceUrl} style={button}>
        Leave a reference for {candidateName}
      </a>
      <p style={footer}>
        If you weren&apos;t expecting this, you can safely ignore this email. Your response is
        only shared with {candidateName} in summary form — employers only ever see a short
        written summary, never your raw ratings.
      </p>
    </div>
  )
}
