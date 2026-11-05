import type { WinBackContent } from '@/lib/winback/sequence'
import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark, Signoff } from '@/lib/email/card-layout'

interface WinBackEmailProps {
  content: WinBackContent
  ctaUrl: string
  unsubscribeUrl: string
}

// Sent to members who have gone quiet, up to three times (src/lib/winback).
export default function WinBackEmail({ content, ctaUrl, unsubscribeUrl }: WinBackEmailProps) {
  return (
    <CardEmail
      preheader={content.heading}
      audience="candidate"
      footer={<a href={unsubscribeUrl} style={{ color: MUTED }}>Turn off these emails</a>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{content.heading}</Headline>
        {content.body.map((line) => (
          <Lead key={line}>{line}</Lead>
        ))}
        <Button campaign="win_back" href={ctaUrl}>{content.cta}</Button>
        <Signoff align="center" />
        {content.closing && (
          <p style={{ margin: '28px auto 0', maxWidth: '500px', fontSize: '17px', lineHeight: '1.6' }}>{content.closing}</p>
        )}
      </Card>
    </CardEmail>
  )
}
