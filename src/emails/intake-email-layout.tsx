import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag, type EmailAudience } from '@/lib/email/audience-tag'
import { Masthead, PAPER, emailAsset } from '@/lib/email/card-layout'

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
  backgroundColor: PAPER,
  border: '1px solid #ece4d4',
  borderRadius: '24px',
  ...emailStyles.body,
}

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
  label,
  subheading,
  children,
  footerNote,
  unsubscribeUrl,
  audience = 'candidate',
}: {
  heading: string
  /** The small label on the right of the masthead: what kind of email this is. */
  label: string
  subheading?: string
  children: React.ReactNode
  footerNote: string
  unsubscribeUrl?: string
  /** Most intake emails go to the candidate; the approval digest and firm invite go to recruiters. */
  audience?: EmailAudience
}) {
  const postal = process.env.INTAKE_POSTAL_ADDRESS
  return (
    <div style={container}>
      <Masthead name={heading} right={label} />
      {subheading && <p style={{ ...sub, margin: '0 0 12px' }}>{subheading}</p>}
      <div style={{ margin: '0 0 20px', lineHeight: '0', fontSize: '0' }}>
        <img src={emailAsset('squiggle.png')} width={150} height={8} alt="" style={{ display: 'inline-block', border: 0 }} />
      </div>
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
      <AudienceTag audience={audience} />
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
