import { emailStyles } from '@/lib/email/email-styles'
import type { Grade } from '@/lib/scoring/grade'

interface GradeCalibratedUpEmailProps {
  firstName: string | null
  previousGrade: Grade
  newGrade: Grade
  marketRealityReportUrl: string
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

const statBox: React.CSSProperties = {
  marginTop: '20px',
  padding: '16px',
  borderRadius: '8px',
  backgroundColor: '#eaf4ef',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '20px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function GradeCalibratedUpEmail({
  firstName,
  previousGrade,
  newGrade,
  marketRealityReportUrl,
  unsubscribeUrl,
}: GradeCalibratedUpEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>
        Your Market Reality grade just moved up.
      </p>
      <p>
        {firstName ? `Hi ${firstName}, ` : ''}
        your search is converting better than we estimated, so we&apos;re updating your grade up
        to reflect that. Nice work.
      </p>
      <div style={statBox}>
        <p style={{ margin: 0, fontWeight: 600 }}>
          {previousGrade} → {newGrade}
        </p>
        <p style={{ margin: '8px 0 0' }}>
          This is a real read on what&apos;s actually happening in your search, not a fixed
          score — it&apos;ll keep updating as we see more.
        </p>
      </div>
      <a href={marketRealityReportUrl} style={button}>
        See your full Market Reality Report →
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn off these emails
        </a>
      </p>
    </div>
  )
}
