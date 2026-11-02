import type { Grade } from '@/lib/scoring/grade'
import { Button, Card, CardEmail, Headline, Hero, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface GradeCalibratedUpEmailProps {
  firstName: string | null
  previousGrade: Grade
  newGrade: Grade
  marketRealityReportUrl: string
  unsubscribeUrl: string
}

export default function GradeCalibratedUpEmail({
  firstName,
  previousGrade,
  newGrade,
  marketRealityReportUrl,
  unsubscribeUrl,
}: GradeCalibratedUpEmailProps) {
  return (
    <CardEmail
      audience="candidate"
      preheader={`Your grade moved from ${previousGrade} to ${newGrade}.`}
      footer={
        <a href={unsubscribeUrl} style={{ color: MUTED }}>
          Turn off these emails
        </a>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Your Market Reality Assessment just moved up.</Headline>
        <Hero value={`${previousGrade} → ${newGrade}`} caption="Your grade" />
        <Lead>
          {firstName ? `Hi ${firstName}, ` : ''}
          your search is converting better than we estimated, so we&apos;re updating your grade up to reflect that. Nice work.
        </Lead>
        <Lead>
          This is a real read on what&apos;s actually happening in your search, not a fixed score — it&apos;ll keep updating as we see more.
        </Lead>
        <Button href={marketRealityReportUrl}>See your full Market Reality Report</Button>
      </Card>
    </CardEmail>
  )
}
