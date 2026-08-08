import { emailStyles } from '@/lib/email/email-styles'

interface DigestCandidate {
  name: string
  email: string
  primaryFunction: string
  level: string
  targetRoleType: string
  industry: string
  geo: string
}

interface AdminRecruiterDigestEmailProps {
  candidates: DigestCandidate[]
  recruiterCount: number
  adminUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '520px',
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

// Internal-only, so unlike the recruiter-facing digest this can show full
// PII — mirrors what the admin already sees on the Recruiter Database page.
export default function AdminRecruiterDigestEmail({
  candidates,
  recruiterCount,
  adminUrl,
}: AdminRecruiterDigestEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter Admin</p>
      <p>
        {candidates.length} candidate{candidates.length === 1 ? '' : 's'} unlocked recruiter-database visibility
        today and {recruiterCount === 1 ? 'was' : 'were'} announced to {recruiterCount} opted-in recruiter
        {recruiterCount === 1 ? '' : 's'}:
      </p>
      {candidates.map((c, i) => (
        <div key={i} style={card}>
          <p style={{ margin: 0 }}>
            <strong>{c.name}</strong> — {c.email}
          </p>
          <p style={{ margin: '4px 0 0', color: '#555' }}>
            {c.targetRoleType} · {c.primaryFunction} · {c.level} · {c.industry} · {c.geo}
          </p>
        </div>
      ))}
      <a href={adminUrl} style={button}>
        View Recruiter Database →
      </a>
    </div>
  )
}
