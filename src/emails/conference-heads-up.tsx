import { Button, Card, CardEmail, Headline, INK, Lead, MUTED, Wordmark, BRAND } from '@/lib/email/card-layout'

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

export default function ConferenceHeadsUpEmail({ firstName, headline, eventName, when, where, cost, steps, eventUrl, planUrl, unsubscribeUrl, buttons }: Props) {
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
          {firstName ? `Hi ${firstName}, ` : ''}
          <a href={eventUrl} style={{ color: BRAND }}>{eventName}</a> is {when}{where ? ` in ${where}` : ''}. {/[.!?]$/.test(cost) ? cost : `${cost}.`}
        </Lead>
        <div style={{ textAlign: 'left', margin: '0 0 28px', fontSize: '16px', lineHeight: '1.6', color: INK }}>
          <ol style={{ margin: 0, paddingLeft: '22px' }}>
            {steps.map((s) => (
              <li key={s} style={{ marginBottom: '6px' }}>{s}</li>
            ))}
          </ol>
        </div>
        {buttons?.length ? (
          <p style={{ margin: 0 }}>
            {buttons.map((b) => (
              <a
                key={b.label}
                href={b.href}
                style={{ display: 'inline-block', margin: '0 4px 8px', padding: '14px 28px', backgroundColor: '#2e7d5b', color: '#ffffff', borderRadius: '999px', textDecoration: 'none', fontWeight: 600, fontSize: '16px' }}
              >
                {b.label}
              </a>
            ))}
          </p>
        ) : (
          <Button href={planUrl}>See your plan and message drafts</Button>
        )}
      </Card>
    </CardEmail>
  )
}
