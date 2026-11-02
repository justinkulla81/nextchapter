import { Button, Card, CardEmail, Lead, Wordmark } from '@/lib/email/card-layout'

interface AdminNudgeEmailProps {
  bodyText: string
  ctaLabel: string
  ctaUrl: string
}

// Admin-edited free text — split on blank lines into paragraphs so the
// admin's own line breaks (from the compose textarea) render as real
// paragraphs rather than one run-on block.
export default function AdminNudgeEmail({ bodyText, ctaLabel, ctaUrl }: AdminNudgeEmailProps) {
  const paragraphs = bodyText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  return (
    <CardEmail preheader={paragraphs[0]?.slice(0, 120)} audience="candidate">
      <Card center pad="28px 32px 36px">
        <Wordmark />
        {paragraphs.map((paragraph, i) => (
          <Lead key={i}>{paragraph}</Lead>
        ))}
        <Button href={ctaUrl}>{ctaLabel}</Button>
      </Card>
    </CardEmail>
  )
}
