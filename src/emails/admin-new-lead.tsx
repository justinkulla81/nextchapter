import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

interface AdminNewLeadEmailProps {
  email: string
  name: string | null
  channel: string
  detail: string
  listUrl: string
  crmUrl: string | null
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

const row: React.CSSProperties = {
  margin: '4px 0',
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

// One email per new address captured on the public site (see notifyNewLead in
// src/lib/leads/notify-new-lead.ts). The daily digest also lists them.
export default function AdminNewLeadEmail({ email, name, channel, detail, listUrl, crmUrl }: AdminNewLeadEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter Admin</p>
      <p>New email captured: {channel}</p>
      <p style={row}>Email: {email}</p>
      {name && <p style={row}>Name: {name}</p>}
      {detail && <p style={row}>From: {detail}</p>}
      {crmUrl && (
        <a href={crmUrl} style={button}>
          Open in CRM →
        </a>
      )}
      <p style={row}>
        <a href={listUrl}>See all captured emails</a>
      </p>
      <AudienceTag audience="admin" />
    </div>
  )
}
