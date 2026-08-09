import { emailStyles } from '@/lib/email/email-styles'

interface VisitorSummary {
  ip: string
  location: string | null
  visitCount: number
  firstSeen: string
  links: { href: string; label: string }[]
  referrer: string | null
  userAgent: string | null
}

interface HomepageVisitorDigestEmailProps {
  date: string
  visitors: VisitorSummary[]
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

// Sent once a day (bounded — never scales with traffic volume, unlike a
// per-visitor alert would), summarizing every non-owner IP that hit the
// homepage that day, grouped by IP with the pages they clicked into.
export default function HomepageVisitorDigestEmail({ date, visitors, adminUrl }: HomepageVisitorDigestEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter Admin</p>
      <p>
        {visitors.length} visitor{visitors.length === 1 ? '' : 's'} to your homepage on {date}:
      </p>
      {visitors.map((v, i) => (
        <div key={i} style={card}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            {v.ip} — {v.visitCount} visit{v.visitCount === 1 ? '' : 's'}, first at {v.firstSeen}
          </p>
          {v.location && (
            <p style={{ margin: '4px 0 0', color: '#555' }}>📍 {v.location}</p>
          )}
          {v.referrer && (
            <p style={{ margin: '4px 0 0', color: '#555' }}>Came from: {v.referrer}</p>
          )}
          {v.userAgent && <p style={{ margin: '4px 0 0', color: '#555' }}>{v.userAgent}</p>}
          {v.links.length > 0 && (
            <p style={{ margin: '8px 0 0' }}>
              Clicked:{' '}
              {v.links.map((l, j) => (
                <span key={j}>
                  {j > 0 && ', '}
                  <a href={l.href} style={{ color: '#2e7d5b' }}>
                    {l.label}
                  </a>
                </span>
              ))}
            </p>
          )}
        </div>
      ))}
      <a href={adminUrl} style={button}>
        View all visitors →
      </a>
    </div>
  )
}
