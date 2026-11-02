import { Button, Card, CardEmail, Headline, INK, Lead, MUTED, Wordmark, BRAND } from '@/lib/email/card-layout'

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

export default function ConferenceNewEventsEmail({ firstName, headline, events, planUrl, unsubscribeUrl }: Props) {
  return (
    <CardEmail
      preheader={headline}
      audience="candidate"
      footer={<a href={unsubscribeUrl} style={{ color: MUTED }}>Turn off these reminders</a>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{headline}</Headline>
        <Lead>
          {firstName ? `Hi ${firstName}, ` : ''}we just added {events.length === 1 ? 'a conference' : 'conferences'} that fit your field.
        </Lead>
        <div style={{ textAlign: 'left', margin: '0 0 28px', fontSize: '16px', lineHeight: '1.5', color: INK }}>
          {events.map((e) => (
            <div key={e.url} style={{ margin: '0 0 12px', padding: '16px 20px', backgroundColor: '#e8f0f8', borderRadius: '16px' }}>
              <p style={{ margin: 0, fontWeight: 700 }}>
                <a href={e.url} style={{ color: BRAND }}>{e.name}</a>
              </p>
              <p style={{ margin: '4px 0 0', color: MUTED }}>{e.when}{e.where ? ` · ${e.where}` : ''}</p>
              <p style={{ margin: '4px 0 0' }}>{e.cost}</p>
              <p style={{ margin: '4px 0 0' }}>{e.speaking}</p>
              <p style={{ margin: '4px 0 0', color: MUTED }}>{e.why}</p>
            </div>
          ))}
        </div>
        <Button href={planUrl}>See them and save the ones you want</Button>
      </Card>
    </CardEmail>
  )
}
