import { Body, Card, CardEmail, Headline, LinkButton, Small, Wordmark } from '@/lib/email/card-layout'

interface ReferenceRequestEmailProps {
  candidateName: string
  refereeName: string
  referenceUrl: string
  // PART TWO §9 — the wording must never expose that the candidate is
  // searching to a referee who might mention it. Confidential-mode framing
  // is "building a professional profile," never "job searching." The
  // headline and preheader are neutral in both modes for the same reason.
  confidentialSearchMode: boolean
}

export default function ReferenceRequestEmail({
  candidateName,
  refereeName,
  referenceUrl,
  confidentialSearchMode,
}: ReferenceRequestEmailProps) {
  return (
    <CardEmail preheader={`${candidateName} asked you for a reference.`} audience="employer">
      <Card pad="28px 32px 36px">
        <Wordmark label="Reference request" />
        <Headline>{candidateName} asked you for a reference</Headline>
        <Body>Hi {refereeName},</Body>
        {confidentialSearchMode ? (
          <Body>
            {candidateName} is putting together a professional profile on NextChapter and asked
            whether you&apos;d be willing to share your perspective on working with them — how they
            operate, not whether they&apos;re looking for anything new.
          </Body>
        ) : (
          <Body>
            {candidateName} is job searching right now, and named you as a reference on NextChapter —
            a hiring platform for people between chapters of their career. A few minutes of your time
            sharing what it was like working with {candidateName} will really help them out.
          </Body>
        )}
        <Body>
          It takes about 15 minutes — a handful of ratings and a couple of short written notes. Your
          answers save as you go, so it&apos;s fine to finish it in more than one sitting.
        </Body>
        <LinkButton href={referenceUrl}>Leave a reference for {candidateName}</LinkButton>
        <Small>
          If you weren&apos;t expecting this, you can safely ignore this email. Your response is
          only shared with {candidateName} in summary form — employers only ever see a short
          written summary, never your raw ratings.
        </Small>
      </Card>
    </CardEmail>
  )
}
