import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface ScholarshipDecisionEmailProps {
  firstName: string | null
  approved: boolean
}

export default function ScholarshipDecisionEmail({ firstName, approved }: ScholarshipDecisionEmailProps) {
  return (
    <CardEmail
      audience="candidate"
      preheader={approved ? 'Your scholarship application was approved.' : 'An update on your scholarship application.'}
      footer={<span style={{ color: MUTED }}>If you have questions, just reply to this email — a real person reads every response.</span>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        {approved ? (
          <>
            <Headline>
              Hi {firstName || 'there'}, thanks for sharing what you did — we&apos;ve approved your scholarship application for reduced or free access to Coaching Premium.
            </Headline>
            <Lead>Our team will reach out shortly to get you set up.</Lead>
            <Button href="https://launchyournextchapter.com/dashboard/plans">View your plans</Button>
          </>
        ) : (
          <>
            <Headline>
              Hi {firstName || 'there'}, thanks for sharing what you did. We weren&apos;t able to approve this application right now, but circumstances change — you&apos;re welcome to apply again anytime.
            </Headline>
            <Lead>
              In the meantime, the free core of NextChapter — your Market Reality Report, Resume Studio, job
              matching, and community — stays fully available to you, no cost, no time limit.
            </Lead>
          </>
        )}
      </Card>
    </CardEmail>
  )
}
