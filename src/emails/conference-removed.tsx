import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

interface Props {
  firstName: string | null
  conferenceName: string
  /** Why we took it off, in our words. */
  reason: string
  /** What the member wrote about it (goals and notes), so nothing they wrote is lost. */
  goals: string | null
  notes: string | null
  addUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px', margin: '0 auto', padding: '32px 24px', color: '#0a0a0a', ...emailStyles.body, fontSize: '15px',
}
const button: React.CSSProperties = {
  display: 'inline-block', backgroundColor: '#2e7d5b', color: '#ffffff', textDecoration: 'none', padding: '12px 20px', borderRadius: '8px', marginTop: '16px', ...emailStyles.cta,
}

// A one-off service message about something the member added, not a marketing email: no unsubscribe link.
export default function ConferenceRemovedEmail({ firstName, conferenceName, reason, goals, notes, addUrl }: Props) {
  return (
    <div style={container}>
      <p style={{ fontSize: '20px', fontWeight: 700, color: '#0b2545' }}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>We took {conferenceName} off your conferences</p>
      <p>{firstName ? `Hi ${firstName}, ` : ''}we reviewed {conferenceName} and removed it. {reason}</p>
      {(goals || notes) && (
        <div style={{ margin: '16px 0', padding: '12px 16px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>What you wrote about it, so you keep it</p>
          {goals && <p style={{ margin: '8px 0 0' }}>Your goals: {goals}</p>}
          {notes && <p style={{ margin: '8px 0 0' }}>Your notes: {notes}</p>}
        </div>
      )}
      <p>If you meant a different conference, paste its link and it is added right away.</p>
      <a href={addUrl} style={button}>Add a conference →</a>
      <AudienceTag audience="candidate" />
    </div>
  )
}
