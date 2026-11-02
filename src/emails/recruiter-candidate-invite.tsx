import { Button, Card, CardEmail, Headline, Lead, Wordmark } from '@/lib/email/card-layout'

interface RecruiterCandidateInviteEmailProps {
  recruiterName: string
  firmName: string | null
  acceptUrl: string
}

// Sent from a recruiter's own private candidate book — the CTA is a
// Supabase-minted magic link (action_link from admin.generateLink), not a
// link to a NextChapter accept page. Don't swap this for a same-domain link;
// that would break the pre-confirmed session the link is supposed to carry.
export default function RecruiterCandidateInviteEmail({
  recruiterName,
  firmName,
  acceptUrl,
}: RecruiterCandidateInviteEmailProps) {
  const who = `${recruiterName}${firmName ? ` (${firmName})` : ''}`
  return (
    <CardEmail
      preheader={`${who} wants to work with you.`}
      audience="candidate"
      footer={<>If you weren&apos;t expecting this, you can ignore this email.</>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{who} wants to work with you</Headline>
        <Lead>
          They suggested you set up a free NextChapter account — a platform that turns your job search into a structured, coached plan and
          gives recruiters a direct line to reach you.
        </Lead>
        <Button href={acceptUrl}>Set up your account</Button>
      </Card>
    </CardEmail>
  )
}
