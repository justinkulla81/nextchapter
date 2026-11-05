import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark, Signoff } from '@/lib/email/card-layout'

interface Week1KickoffEmailProps {
  firstName: string | null
  victoriaName: 'Victoria' | 'Vicki' | 'Vic'
  onboardingComplete: boolean
  actionItems: string[]
  appUrl: string
  unsubscribeUrl: string
}

export default function Week1KickoffEmail({
  firstName,
  victoriaName,
  onboardingComplete,
  actionItems,
  appUrl,
  unsubscribeUrl,
}: Week1KickoffEmailProps) {
  return (
    <CardEmail
      audience="candidate"
      preheader={`${victoriaName}, your AI coach at NextChapter, is here to get you started.`}
      footer={
        <>
          Don&apos;t want daily emails?{' '}
          <a href={unsubscribeUrl} style={{ color: MUTED }}>
            Turn them off
          </a>
          .
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          Hi {firstName || 'there'} — I&apos;m {victoriaName}, your AI coach here at NextChapter.
        </Headline>
        <Lead>
          I&apos;ll check in with you, help build your plan, and always give it to you straight — but I&apos;m completely in your corner. Let&apos;s get started.
        </Lead>
        <Lead>
          {onboardingComplete
            ? "Your first week isn't about hitting a points target — it's about making real progress on these:"
            : "Before anything else, let's get your account fully set up — everything I recommend after this gets a lot more useful once these are done:"}
        </Lead>
        <div style={{ textAlign: 'left', margin: '0 auto 28px', maxWidth: '500px', fontSize: '16px', lineHeight: '1.6' }}>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {actionItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <Lead>
          {onboardingComplete
            ? "Do these, and you'll walk into next week with real material to work from."
            : "Once these are done, I'll have real, personalized next steps ready for you."}
        </Lead>
        <Button href={`${appUrl}/dashboard`}>See my first-week checklist</Button>
        <Signoff name={victoriaName} align="center" />
      </Card>
    </CardEmail>
  )
}
