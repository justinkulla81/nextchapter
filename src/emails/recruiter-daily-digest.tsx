import { emailStyles } from '@/lib/email/email-styles'

interface DigestCandidate {
  primaryFunction: string
  level: string
  targetRoleType: string
  industry: string
  geo: string
}

interface RecruiterDailyDigestEmailProps {
  fullName: string
  candidates: DigestCandidate[]
  portalUrl: string
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

const card: React.CSSProperties = {
  marginTop: '16px',
  padding: '14px 16px',
  border: '1px solid #e5e7eb',
  borderRadius: '10px',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '20px',
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

// Sent once a day (never per-candidate — batched to avoid an inbox-spam
// pattern) whenever one or more candidates crossed into (opted-in AND
// A-grade) since the last digest. Deliberately keeps PII light per
// candidate (function/level/target role/industry/geo, no name or contact
// info) — same reasoning as the retired per-candidate alert this replaced.
export default function RecruiterDailyDigestEmail({
  fullName,
  candidates,
  portalUrl,
  unsubscribeUrl,
}: RecruiterDailyDigestEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {fullName.split(' ')[0]},</p>
      <p>
        {candidates.length} new A-grade candidate{candidates.length === 1 ? '' : 's'} unlocked visibility
        in the Recruiter Database today:
      </p>
      {candidates.map((c, i) => (
        <div key={i} style={card}>
          <p style={{ margin: 0 }}>
            <strong>{c.targetRoleType}</strong> · {c.primaryFunction} · {c.level}
          </p>
          <p style={{ margin: '4px 0 0', color: '#555' }}>
            {c.industry} · {c.geo}
          </p>
        </div>
      ))}
      <a href={portalUrl} style={button}>
        View &amp; message candidates →
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl}>Unsubscribe from these alerts</a>
      </p>
    </div>
  )
}
