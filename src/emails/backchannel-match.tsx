import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

export interface BackchannelPerson {
  name: string
  title: string | null
  email: string | null
  // Prefilled Gmail draft when we have their email, else their contact page.
  actionUrl: string
}

interface BackchannelMatchEmailProps {
  firstName: string | null
  companyName: string
  role: string | null
  // NC's own page for the listing, when we have it; the role isn't a link otherwise.
  roleUrl: string | null
  appliedOn: string | null
  people: BackchannelPerson[]
  moreCount: number
  moreUrl: string
  // One example of the draft each Email button opens.
  note: { subject: string; body: string }
  // Why a note from inside is worth sending: one sourced stat, rotated per email.
  why: { text: string; source: string; url: string }
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
  padding: '8px 16px',
  borderRadius: '8px',
  ...emailStyles.cta,
  fontSize: '14px',
}

const personRow: React.CSSProperties = {
  padding: '16px 0 0',
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function BackchannelMatchEmail({
  firstName,
  companyName,
  role,
  roleUrl,
  appliedOn,
  people,
  moreCount,
  moreUrl,
  note,
  why,
  otherCompanyCount,
  otherCompaniesUrl,
  unsubscribeUrl,
}: BackchannelMatchEmailProps) {
  const roleLabel = role ? <strong>{role}</strong> : 'a role'
  const roleNode = role && roleUrl ? <a href={roleUrl} style={{ color: '#0b2545' }}>{roleLabel}</a> : roleLabel

  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>
        You may have a way in at {companyName}.
      </p>
      <p>
        {firstName ? `Hi ${firstName}, ` : ''}
        {role ? <>you applied for {roleNode} at {companyName}</> : <>you applied to {companyName}</>}
        {appliedOn ? ` on ${appliedOn}` : ''}. {people.length + moreCount === 1 ? 'Someone' : 'People'} you know
        {people.length + moreCount === 1 ? ' works' : ' work'} there, and a word from inside gets your name in front of a
        real person.
      </p>
      <p style={{ ...emailStyles.muted, margin: 0 }}>
        {why.text}{' '}
        <a href={why.url} style={{ color: '#4a5568' }}>
          {why.source}
        </a>
      </p>
      <div>
        {people.map((person) => (
          <div key={person.actionUrl} style={personRow}>
            <p style={{ margin: 0, fontWeight: 600 }}>{person.name}</p>
            {person.title && <p style={{ ...emailStyles.muted, margin: 0 }}>{person.title}</p>}
            {person.email && <p style={{ ...emailStyles.muted, margin: 0 }}>{person.email}</p>}
            <p style={{ margin: '8px 0 0' }}>
              {person.email ? (
                <a href={person.actionUrl} style={button}>
                  Email {person.name.split(/\s+/)[0]}
                </a>
              ) : (
                <a href={person.actionUrl} style={{ color: '#0b2545' }}>
                  No email yet. Add one on their contact page
                </a>
              )}
            </p>
          </div>
        ))}
        {moreCount > 0 && (
          <p style={{ ...personRow, margin: 0 }}>
            <a href={moreUrl} style={{ color: '#0b2545' }}>
              And {moreCount} more at {companyName}
            </a>
          </p>
        )}
      </div>
      <p style={{ ...emailStyles.muted, margin: '24px 0 0' }}>
        {people.some((person) => person.email)
          ? 'The draft each Email button opens. Edit it, then send.'
          : 'A note you could send. Add an email on a contact’s page and we’ll open it as a Gmail draft.'}
      </p>
      <p style={noteBox}>{note.body}</p>
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
