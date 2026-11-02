import type { OutplacementProgramType } from '@prisma/client'
import { PROGRAM_TYPE_BENEFIT, PROGRAM_TYPE_PITCH } from '@/lib/employer/program-type'
import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface OutplacementSeatInviteEmailProps {
  orgName: string
  acceptUrl: string
  // From the employer's Program page: their welcome, and the services they
  // offer. Null = the generic description.
  welcome?: string | null
  services?: string[] | null
  programType?: OutplacementProgramType
}

// Sent when an employer_admin enrolls someone who has no existing
// NextChapter account — same "admin-generated, pre-confirmed magic link"
// shape as CoachClientInviteEmail. Deliberately does not name the employer
// contact who did the enrolling (the recipient already knows — their own
// HR department told them this benefit was coming) and does not put
// anything about the org's internal contract/tier details in the email
// body, which would have no reason to leave the org side.
export default function OutplacementSeatInviteEmail({ orgName, acceptUrl, welcome, services, programType = 'OUTPLACEMENT' }: OutplacementSeatInviteEmailProps) {
  return (
    <CardEmail
      audience="candidate"
      preheader={`${orgName} has set up a NextChapter benefit for you.`}
      footer={<span style={{ color: MUTED }}>If you weren&apos;t expecting this, you can ignore this email.</span>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          {orgName} has set up a NextChapter {PROGRAM_TYPE_BENEFIT[programType]} benefit for you.
        </Headline>
        <Lead>
          {services?.length ? `Your program includes: ${services.join(', ')}.` : `NextChapter is ${PROGRAM_TYPE_PITCH[programType]}.`} Everything you do there is
          private to you. {orgName} never sees your individual activity, only anonymous, aggregate participation
          numbers across everyone enrolled.
        </Lead>
        {welcome && (
          <div style={{ textAlign: 'left', margin: '0 auto 28px', maxWidth: '500px' }}>
            <p style={{ margin: 0, whiteSpace: 'pre-line', borderLeft: '3px solid #e5e5e5', paddingLeft: '12px', fontSize: '16px', lineHeight: '1.6' }}>{welcome}</p>
          </div>
        )}
        <Button href={acceptUrl}>Set up your account</Button>
      </Card>
    </CardEmail>
  )
}
