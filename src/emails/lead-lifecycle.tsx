import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'
import type { LeadEmailContent } from '@/lib/leads/lifecycle/content'

interface LeadLifecycleEmailProps {
  content: LeadEmailContent
  ctaUrl: string | null
  unsubscribeUrl: string
  postalAddress: string
  /** The open-tracking pixel; absent on test sends. */
  pixelUrl?: string
  audience: 'candidate' | 'general'
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}
const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#0b2545' }
const button: React.CSSProperties = {
  display: 'inline-block',
  marginTop: '8px',
  padding: '12px 20px',
  backgroundColor: '#f4a259',
  color: '#0b2545',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}
const footer: React.CSSProperties = { marginTop: '32px', ...emailStyles.muted }

// The follow-up to a public signup (see src/lib/leads/lifecycle). One message,
// one button; the wording lives in content.ts.
export default function LeadLifecycleEmail({ content, ctaUrl, unsubscribeUrl, postalAddress, pixelUrl, audience }: LeadLifecycleEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>
        <strong>{content.headline}</strong>
      </p>
      {content.paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
      {content.benefits.length > 0 && (
        <ul style={{ paddingLeft: '20px' }}>
          {content.benefits.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      )}
      {content.ctaLabel && ctaUrl && (
        <a href={ctaUrl} style={button}>
          {content.ctaLabel} →
        </a>
      )}
      <p style={footer}>
        {content.footerNote} <a href={unsubscribeUrl}>Unsubscribe</a>
        {postalAddress ? <> · NextChapter, {postalAddress}</> : null}
      </p>
      {pixelUrl && <img src={pixelUrl} width={1} height={1} alt="" style={{ display: 'block' }} />}
      <AudienceTag audience={audience} />
    </div>
  )
}
