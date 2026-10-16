import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

interface BackchannelMatchEmailProps {
  firstName: string | null
  companyName: string
  role: string | null
  appliedOn: string | null
  contact: { name: string; title: string | null }
  moreContactCount: number
  note: { subject: string; body: string }
  // Opens a prefilled compose window when the contact has an email on file;
  // otherwise falls back to the candidate's network page.
  actionUrl: string
  actionLabel: string
  contactHasEmail: boolean
  otherCompanyCount: number
  otherCompaniesUrl: string
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

const noteBox: React.CSSProperties = {
  backgroundColor: '#f4f6f8',
  borderRadius: '8px',
  padding: '16px',
  margin: '8px 0 0',
  whiteSpace: 'pre-wrap',
  fontSize: '14px',
  lineHeight: '1.6',
}

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 24px',
  borderRadius: '8px',
  marginTop: '16px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function BackchannelMatchEmail({
  firstName,
  companyName,
  role,
  appliedOn,
  contact,
  moreContactCount,
  note,
  actionUrl,
  actionLabel,
  contactHasEmail,
  otherCompanyCount,
  otherCompaniesUrl,
  unsubscribeUrl,
}: BackchannelMatchEmailProps) {
  const applied = role ? <strong>{role}</strong> : 'a role'

  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>
        {contact.name} works at {companyName}.
      </p>
      <p>
        {firstName ? `Hi ${firstName}, ` : ''}
        you applied for {applied} at {companyName}
        {appliedOn ? ` on ${appliedOn}` : ''}, and {contact.name}
        {contact.title ? ` (${contact.title})` : ''} is in your network
        {moreContactCount > 0 ? `, along with ${moreContactCount} other ${moreContactCount === 1 ? 'person' : 'people'}` : ''}.
        A heads-up from someone inside gets your name in front of a real person, not just a queue.
      </p>
      <p style={{ marginBottom: 0 }}>
        <strong>{contactHasEmail ? 'Here’s a note you can send as-is:' : 'Here’s a note you can send:'}</strong>
      </p>
      <p style={noteBox}>{note.body}</p>
      <a href={actionUrl} style={button}>
        {actionLabel}
      </a>
      <p style={emailStyles.muted}>
        {contactHasEmail
          ? 'Opens a draft in Gmail. Edit it, then send. If they’ve moved on, skip this one.'
          : 'We don’t have an email for them yet. Add one on their contact page, or copy the note above.'}
      </p>
      {otherCompanyCount > 0 && (
        <p style={emailStyles.muted}>
          You also know people at {otherCompanyCount} other{' '}
          {otherCompanyCount === 1 ? 'company' : 'companies'} you’ve applied to.{' '}
          <a href={otherCompaniesUrl} style={{ color: '#4a5568' }}>
            See who
          </a>
        </p>
      )}
      <p style={footer}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn off these emails
        </a>
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
