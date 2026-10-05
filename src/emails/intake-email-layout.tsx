import { emailStyles } from '@/lib/email/email-styles'

// Shared shell for NextChapter Talent emails. The footer carries what
// CAN-SPAM needs on anything sent on a recruiter's behalf: who sent it and
// why, a working unsubscribe link, and the postal address
// (INTAKE_POSTAL_ADDRESS — must be set before replies are switched on).

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '520px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}

const brand: React.CSSProperties = { fontSize: '18px', fontWeight: 700, color: '#0b2545', margin: 0 }
const sub: React.CSSProperties = { ...emailStyles.muted, margin: '0 0 24px' }
const footer: React.CSSProperties = { marginTop: '32px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', ...emailStyles.muted }
export const intakeButton: React.CSSProperties = {
  display: 'inline-block',
  background: '#1d4e89',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
  ...emailStyles.cta,
}

export function IntakeEmailLayout({
  heading,
  subheading,
  children,
  footerNote,
  unsubscribeUrl,
}: {
  heading: string
  subheading?: string
  children: React.ReactNode
  footerNote: string
  unsubscribeUrl?: string
}) {
  const postal = process.env.INTAKE_POSTAL_ADDRESS
  return (
    <div style={container}>
      <p style={brand}>{heading}</p>
      {subheading && <p style={sub}>{subheading}</p>}
      {children}
      <div style={footer}>
        <p style={{ margin: '0 0 8px' }}>{footerNote}</p>
        {unsubscribeUrl && (
          <p style={{ margin: '0 0 8px' }}>
            <a href={unsubscribeUrl}>Unsubscribe</a> from these emails.
          </p>
        )}
        {postal && <p style={{ margin: 0 }}>NextChapter · {postal}</p>}
      </div>
    </div>
  )
}

export function TextParagraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((block, i) => (
        <p key={i} style={{ whiteSpace: 'pre-line' }}>
          {block}
        </p>
      ))}
    </>
  )
}
