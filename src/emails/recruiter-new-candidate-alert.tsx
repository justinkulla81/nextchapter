import { emailStyles } from '@/lib/email/email-styles'

interface RecruiterNewCandidateAlertEmailProps {
  fullName: string
  primaryFunction: string
  level: string
  targetRoleType: string
  industry: string
  geo: string
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

// Sent when a candidate crosses into (opted-in AND A-grade) — see
// bucketRecruiterDatabaseRows's pendingNotify bucket. Deliberately keeps
// PII light (function/level/target role/industry/geo, no name or contact
// info) — the full profile lives behind the portal login, not in an email
// that could be forwarded.
export default function RecruiterNewCandidateAlertEmail({
  fullName,
  primaryFunction,
  level,
  targetRoleType,
  industry,
  geo,
  portalUrl,
  unsubscribeUrl,
}: RecruiterNewCandidateAlertEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {fullName.split(' ')[0]},</p>
      <p>A new A-grade candidate just unlocked visibility in the Recruiter Database:</p>
      <ul>
        <li>Target role: {targetRoleType}</li>
        <li>Function: {primaryFunction}</li>
        <li>Level: {level}</li>
        <li>Industry: {industry}</li>
        <li>Location: {geo}</li>
      </ul>
      <a href={portalUrl} style={button}>
        View the Recruiter Database →
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl}>Unsubscribe from these alerts</a>
      </p>
    </div>
  )
}
