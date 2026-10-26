import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

export interface LayoffAlertEmailNotice {
  employer: string
  state: string
  place: string | null
  workers: number | null
  filedOn: string
  href: string
}

interface LayoffAlertDigestEmailProps {
  watching: string
  notices: LayoffAlertEmailNotice[]
  startUrl: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '520px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#0b2545' }
const row: React.CSSProperties = { margin: '0 0 14px', lineHeight: '1.5' }
const button: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '12px',
  padding: '12px 20px',
  backgroundColor: '#f4a259',
  color: '#0b2545',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}
const footer: React.CSSProperties = { marginTop: '32px', ...emailStyles.muted }

/** New WARN layoff notices for what the person is watching. Facts from the public filing only. */
export default function LayoffAlertDigestEmail({ watching, notices, startUrl, unsubscribeUrl }: LayoffAlertDigestEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>
        <strong>
          {notices.length} new layoff {notices.length === 1 ? 'notice' : 'notices'} for {watching}
        </strong>
      </p>
      {notices.map((n) => (
        <p key={n.href + n.filedOn} style={row}>
          <a href={n.href} style={{ fontWeight: 600 }}>
            {n.employer}
          </a>
          <br />
          {n.workers != null ? `${n.workers.toLocaleString()} workers named` : 'Worker count not published'} · {n.place ? `${n.place}, ` : ''}
          {n.state} · filed {n.filedOn}
        </p>
      ))}
      <p style={{ marginTop: '20px' }}>
        These come from the notices employers file with state labor departments. A notice gives the numbers and dates the employer reported; it does not say who is affected or why.
      </p>
      <p>If this touches you or someone you know, the first week matters most. We have a short plan, and it takes about five minutes to start.</p>
      <a href={startUrl} style={button}>
        See the first-week plan →
      </a>
      <p style={footer}>
        You get this because you asked to be told about layoff notices at launchyournextchapter.com. At most one email a day. <a href={unsubscribeUrl}>Unsubscribe</a>
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
