import type { CSSProperties } from 'react'
import { Card, CardEmail, Headline, INK, Lead, MUTED, BRAND, Wordmark } from '@/lib/email/card-layout'

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

const noteBox: CSSProperties = {
  backgroundColor: '#e8f0f8',
  borderRadius: '16px',
  padding: '16px 20px',
  margin: '8px 0 0',
  whiteSpace: 'pre-wrap',
  fontSize: '14px',
  lineHeight: '1.6',
  color: INK,
  textAlign: 'left',
}

const muted: CSSProperties = { margin: 0, fontSize: '14px', lineHeight: '1.5', color: MUTED }

// Smaller green pill for the per-person Email button (the one action per row).
const personButton: CSSProperties = {
  display: 'inline-block',
  padding: '10px 20px',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '14px',
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
  const roleNode = role && roleUrl ? <a href={roleUrl} style={{ color: BRAND }}>{roleLabel}</a> : roleLabel
  // The first person with an email gets the filled green pill; the rest are outlined.
  const primary = people.find((person) => person.email)

  return (
    <CardEmail
      preheader={`You may have a way in at ${companyName}.`}
      audience="candidate"
      footer={
        <a href={unsubscribeUrl} style={{ color: MUTED }}>
          Turn off these emails
        </a>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>You may have a way in at {companyName}.</Headline>
        <Lead>
          {firstName ? `Hi ${firstName}, ` : ''}
          {role ? <>you applied for {roleNode} at {companyName}</> : <>you applied to {companyName}</>}
          {appliedOn ? ` on ${appliedOn}` : ''}. {people.length + moreCount === 1 ? 'Someone' : 'People'} you know
          {people.length + moreCount === 1 ? ' works' : ' work'} there, and a word from inside gets your name in front of a
          real person.
        </Lead>
        <p style={{ ...muted, margin: '0 0 8px' }}>
          {why.text}{' '}
          <a href={why.url} style={{ color: MUTED }}>
            {why.source}
          </a>
        </p>
        <div style={{ textAlign: 'left' }}>
          {people.map((person) => (
            <div key={person.actionUrl} style={{ padding: '16px 0 0' }}>
              <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: INK }}>{person.name}</p>
              {person.title && <p style={muted}>{person.title}</p>}
              {person.email && <p style={muted}>{person.email}</p>}
              <p style={{ margin: '8px 0 0' }}>
                {person.email ? (
                  person === primary ? (
                    <a href={person.actionUrl} style={personButton}>
                      Email {person.name.split(/\s+/)[0]}
                    </a>
                  ) : (
                    <a
                      href={person.actionUrl}
                      style={{ ...personButton, backgroundColor: '#ffffff', color: '#2e7d5b', border: '1.5px solid #2e7d5b', padding: '8.5px 18.5px' }}
                    >
                      Email {person.name.split(/\s+/)[0]}
                    </a>
                  )
                ) : (
                  <a href={person.actionUrl} style={{ color: BRAND }}>
                    No email yet. Add one on their contact page
                  </a>
                )}
              </p>
            </div>
          ))}
          {moreCount > 0 && (
            <p style={{ margin: '16px 0 0', fontSize: '16px' }}>
              <a href={moreUrl} style={{ color: BRAND }}>
                And {moreCount} more at {companyName}
              </a>
            </p>
          )}
          <p style={{ ...muted, margin: '24px 0 0' }}>
            {people.some((person) => person.email)
              ? 'The draft each Email button opens. Edit it, then send.'
              : 'A note you could send. Add an email on a contact’s page and we’ll open it as a Gmail draft.'}
          </p>
          <p style={noteBox}>{note.body}</p>
          {otherCompanyCount > 0 && (
            <p style={{ ...muted, margin: '16px 0 0' }}>
              You also know people at {otherCompanyCount} other{' '}
              {otherCompanyCount === 1 ? 'company' : 'companies'} you’ve applied to.{' '}
              <a href={otherCompaniesUrl} style={{ color: MUTED }}>
                See who
              </a>
            </p>
          )}
        </div>
      </Card>
    </CardEmail>
  )
}
