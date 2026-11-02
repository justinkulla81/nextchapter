import { Card, CardEmail, Headline, Lead, Small, Wordmark } from '@/lib/email/card-layout'

interface ReferenceDeclinedEmailProps {
  candidateName: string
  refereeName: string
}

// Sent to the candidate the moment a referee self-declines via /ref/[token]
// — a quiet, factual notice, not a rejection framed as bad news. The
// referee's own decline reason (if given) is theirs to explain privately,
// not forwarded verbatim here.
export default function ReferenceDeclinedEmail({ candidateName, refereeName }: ReferenceDeclinedEmailProps) {
  return (
    <CardEmail preheader={`${refereeName} is not able to leave you a reference right now`} audience="candidate">
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          {candidateName}, {refereeName} is not able to leave you a reference right now
        </Headline>
        <Lead>
          This happens for all kinds of reasons that have nothing to do with you — timing, company policy, just being swamped.
        </Lead>
        <Lead>Worth reaching out to them directly if you want the full story, or asking someone else instead.</Lead>
        <Small>You can see the status of all your references any time on your References page.</Small>
      </Card>
    </CardEmail>
  )
}
