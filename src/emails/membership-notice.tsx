import { Button, Card, CardEmail, Headline, Lead, Wordmark } from '@/lib/email/card-layout'

interface MembershipNoticeEmailProps {
  heading: string
  bodyLines: string[]
  ctaLabel: string
  ctaUrl: string
}

// Shared, parametrized template for Membership benefit-delivery emails
// (annual Dossier refresh ready, quarterly market check ready, network-
// maintenance nudge, break-glass reactivation confirmation) — one component
// instead of four near-identical ones, following the same "keep it minimal"
// judgment this session has applied elsewhere.
export default function MembershipNoticeEmail({ heading: headingText, bodyLines, ctaLabel, ctaUrl }: MembershipNoticeEmailProps) {
  return (
    <CardEmail
      preheader={bodyLines[0] ?? headingText}
      audience="candidate"
      footer={<>You&apos;re receiving this because you&apos;re on the NextChapter Alumni plan.</>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{headingText}</Headline>
        {bodyLines.map((line, i) => (
          <Lead key={i}>{line}</Lead>
        ))}
        <Button href={ctaUrl}>{ctaLabel}</Button>
      </Card>
    </CardEmail>
  )
}
