import type { OutplacementProgramType } from '@prisma/client'
import { PROGRAM_TYPE_BENEFIT } from '@/lib/employer/program-type'
import { Card, CardEmail, Headline, Lead, Small, Wordmark } from '@/lib/email/card-layout'

interface OutplacementSeatLinkedEmailProps {
  growth?: boolean
  orgName: string
  programType?: OutplacementProgramType
}

// Sent when the enrolled email already had a registered NextChapter
// account — the seat links immediately (no invite/activation step needed),
// so this is a notice, not a call to action. No login link, since the
// recipient already knows how to log in.
export default function OutplacementSeatLinkedEmail({ orgName, programType = 'OUTPLACEMENT' }: OutplacementSeatLinkedEmailProps) {
  return (
    <CardEmail preheader={`${orgName} has set up a NextChapter benefit for your account`} audience="candidate">
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          {orgName} has set up a NextChapter {PROGRAM_TYPE_BENEFIT[programType]} benefit for your account
        </Headline>
        <Lead>Your plan now includes everything in that benefit — nothing about your existing activity, history, or settings changed.</Lead>
        <Lead>
          {orgName} never sees your individual activity on NextChapter, only anonymous, aggregate participation numbers across everyone enrolled.
        </Lead>
        <Small>If you weren&apos;t expecting this, contact support.</Small>
      </Card>
    </CardEmail>
  )
}
