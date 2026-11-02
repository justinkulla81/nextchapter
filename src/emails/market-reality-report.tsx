import { Button, Card, CardEmail, Headline, Lead, Wordmark } from '@/lib/email/card-layout'

interface MarketRealityReportEmailProps {
  candidateName: string
  reportUrl: string
  justEarnedBadge?: boolean
}

export default function MarketRealityReportEmail({
  candidateName,
  reportUrl,
  justEarnedBadge,
}: MarketRealityReportEmailProps) {
  return (
    <CardEmail
      preheader="Find out how employers will actually read your resume."
      audience="candidate"
      footer={<>This report is only visible to you — never shared with employers.</>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>We have your Market Reality Assessment</Headline>
        <Lead>Hi {candidateName},</Lead>
        {justEarnedBadge && <Lead>Nice work — you just earned the &quot;Market Reality Assessment&quot; badge!</Lead>}
        <Lead>Find out how employers will actually read your resume — what&apos;s working, what to fix first.</Lead>
        <Button campaign="market_reality_report" href={reportUrl}>See your grade</Button>
      </Card>
    </CardEmail>
  )
}
