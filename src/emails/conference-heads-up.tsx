import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

interface Props {
  firstName: string | null
  headline: string
  eventName: string
  when: string
  where: string
  cost: string
  steps: string[]
  eventUrl: string
  planUrl: string
  unsubscribeUrl: string
  /** One-click answers (check-in email). Rendered under the steps in place of the plan button. */
  buttons?: { label: string; href: string }[]
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px', margin: '0 auto', padding: '32px 24px', color: '#0a0a0a', ...emailStyles.body, fontSize: '15px',
}
const button: React.CSSProperties = {
  display: 'inline-block', backgroundColor: '#2e7d5b', color: '#ffffff', textDecoration: 'none', padding: '12px 20px', borderRadius: '8px', marginTop: '16px', ...emailStyles.cta,
}

export default function ConferenceHeadsUpEmail({ firstName, headline, eventName, when, where, cost, steps, eventUrl, planUrl, unsubscribeUrl, buttons }: Props) {
  return (
    <div style={container}>
      <p style={{ fontSize: '20px', fontWeight: 700, color: '#0b2545' }}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>{headline}</p>
      <p>
        {firstName ? `Hi ${firstName}, ` : ''}
        <a href={eventUrl} style={{ color: '#0b2545' }}>{eventName}</a> is {when}{where ? ` in ${where}` : ''}. {cost}
      </p>
      <ol style={{ paddingLeft: '20px' }}>
        {steps.map((s) => (
          <li key={s} style={{ marginBottom: '6px' }}>{s}</li>
        ))}
      </ol>
      {buttons?.length ? (
        <p>
          {buttons.map((b) => (
            <a key={b.label} href={b.href} style={{ ...button, marginRight: '8px' }}>{b.label}</a>
          ))}
        </p>
      ) : (
        <a href={planUrl} style={button}>See your plan and message drafts →</a>
      )}
      <p style={{ marginTop: '32px', ...emailStyles.muted }}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>Turn off these reminders</a>
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
