import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

export interface NewEventItem {
  name: string
  url: string
  when: string
  where: string
  cost: string
  speaking: string
  why: string
}

interface Props {
  firstName: string | null
  headline: string
  events: NewEventItem[]
  planUrl: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px', margin: '0 auto', padding: '32px 24px', color: '#0a0a0a', ...emailStyles.body, fontSize: '15px',
}
const button: React.CSSProperties = {
  display: 'inline-block', backgroundColor: '#2e7d5b', color: '#ffffff', textDecoration: 'none', padding: '12px 20px', borderRadius: '8px', marginTop: '16px', ...emailStyles.cta,
}

export default function ConferenceNewEventsEmail({ firstName, headline, events, planUrl, unsubscribeUrl }: Props) {
  return (
    <div style={container}>
      <p style={{ fontSize: '20px', fontWeight: 700, color: '#0b2545' }}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>{headline}</p>
      <p>{firstName ? `Hi ${firstName}, ` : ''}we just added {events.length === 1 ? 'a conference' : 'conferences'} that fit your field.</p>
      {events.map((e) => (
        <div key={e.url} style={{ margin: '16px 0', paddingBottom: '12px', borderBottom: '1px solid #e5e7eb' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            <a href={e.url} style={{ color: '#0b2545' }}>{e.name}</a>
          </p>
          <p style={{ margin: '4px 0 0', color: '#4a5568' }}>{e.when}{e.where ? ` · ${e.where}` : ''}</p>
          <p style={{ margin: '4px 0 0' }}>{e.cost}</p>
          <p style={{ margin: '4px 0 0' }}>{e.speaking}</p>
          <p style={{ margin: '4px 0 0', color: '#4a5568' }}>{e.why}</p>
        </div>
      ))}
      <a href={planUrl} style={button}>See them and save the ones you want →</a>
      <p style={{ marginTop: '32px', ...emailStyles.muted }}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>Turn off these reminders</a>
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
