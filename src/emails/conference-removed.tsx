import { Button, Card, CardEmail, Headline, INK, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

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

// A one-off service message about something the member added, not a marketing email: no unsubscribe link.
export default function ConferenceRemovedEmail({ firstName, conferenceName, reason, goals, notes, addUrl }: Props) {
  return (
    <CardEmail preheader={`We took ${conferenceName} off your conferences`} audience="candidate">
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>We took {conferenceName} off your conferences</Headline>
        <Lead>
          {firstName ? `Hi ${firstName}, ` : ''}we reviewed {conferenceName} and removed it. {reason}
        </Lead>
        {(goals || notes) && (
          <div style={{ textAlign: 'left', margin: '0 0 28px', padding: '20px 24px', backgroundColor: '#e8f0f8', borderRadius: '20px', fontSize: '16px', lineHeight: '1.5', color: INK }}>
            <p style={{ margin: 0, fontWeight: 600 }}>What you wrote about it, so you keep it</p>
            {goals && (
              <p style={{ margin: '8px 0 0' }}>
                <span style={{ color: MUTED }}>Your goals: </span>
                {goals}
              </p>
            )}
            {notes && (
              <p style={{ margin: '8px 0 0' }}>
                <span style={{ color: MUTED }}>Your notes: </span>
                {notes}
              </p>
            )}
          </div>
        )}
        <Lead>If you meant a different conference, paste its link and it is added right away.</Lead>
        <Button href={addUrl}>Add a conference</Button>
      </Card>
    </CardEmail>
  )
}
