import { Button, Card, CardEmail, Headline, Lead, Small, Wordmark } from '@/lib/email/card-layout'

interface Props {
  orgName: string
  endsOn: string
  dashboardUrl: string
  // A career growth seat (people staying and growing) rather than outplacement.
  growth?: boolean
}

// Sent 14 days before an outplacement seat's access ends, only when the
// employer switched access-ending notices on.
export default function OutplacementAccessEndingEmail({ orgName, endsOn, dashboardUrl, growth }: Props) {
  return (
    <CardEmail preheader={`The NextChapter benefit from ${orgName} ends on ${endsOn}`} audience="candidate">
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          The NextChapter benefit from {orgName} ends on {endsOn}
        </Headline>
        <Lead>
          Until then everything stays open{growth ? ': coaching, the recruiter network and your career plan' : ': coaching, the recruiter network and your search plan'}.
        </Lead>
        <Lead>
          {growth
            ? 'Your career story, goals, learning paths and pay research are yours and stay on your free account. Only the coaching and recruiter network your employer provided stop. Nothing about your plan changes on that day.'
            : 'Your search plan, tracked jobs and contacts stay on your free account. Only the coaching and recruiter network your employer provided stop. Download your resume and anything else you want to keep.'}
        </Lead>
        <Button href={dashboardUrl}>Open NextChapter</Button>
        <Small>{orgName} never sees your activity on NextChapter. Questions? Reply to this email.</Small>
      </Card>
    </CardEmail>
  )
}
