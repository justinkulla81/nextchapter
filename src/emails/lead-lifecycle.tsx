import { Body, Card, CardEmail, Headline, LinkButton, MUTED, Signoff, Wordmark } from '@/lib/email/card-layout'
import type { LeadEmailContent } from '@/lib/leads/lifecycle/content'

interface LeadLifecycleEmailProps {
  content: LeadEmailContent
  ctaUrl: string | null
  unsubscribeUrl: string
  postalAddress: string
  /** The open-tracking pixel; absent on test sends. */
  pixelUrl?: string
  audience: 'candidate' | 'general'
}

const choiceButton: React.CSSProperties = {
  display: 'block',
  marginTop: '8px',
  padding: '11px 16px',
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  textAlign: 'center',
  textDecoration: 'none',
  fontWeight: 600,
  color: '#0b2545',
}

// The follow-up to a public signup (see src/lib/leads/lifecycle). One message,
// one button; the wording lives in content.ts.
export default function LeadLifecycleEmail({ content, ctaUrl, unsubscribeUrl, postalAddress, pixelUrl, audience }: LeadLifecycleEmailProps) {
  return (
    <CardEmail
      preheader={content.headline}
      audience={audience}
      footer={
        <>
          {content.footerNote} <a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe</a>
          {postalAddress ? <> · NextChapter, {postalAddress}</> : null}
          {pixelUrl && <img src={pixelUrl} width={1} height={1} alt="" style={{ display: 'block' }} />}
        </>
      }
    >
      <Card pad="28px 32px 36px">
        <Wordmark />
        <Headline>{content.headline}</Headline>
        {content.paragraphs.map((p, i) => (
          <Body key={i}>{p}</Body>
        ))}
        {content.benefits.length > 0 && (
          <ul style={{ margin: '0 0 16px', paddingLeft: 20, fontSize: '16px', lineHeight: '1.6' }}>
            {content.benefits.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
        {content.choices && content.choices.length > 0 && (
          <>
            <Body>
              <strong>{content.choicesPrompt}</strong>
            </Body>
            {content.choices.map((o) => (
              <a key={o.label} href={o.url} style={choiceButton}>
                {o.label}
              </a>
            ))}
            {content.ctaLabel && ctaUrl && (
              <p style={{ margin: '16px 0 0', fontSize: '16px' }}>
                <a href={ctaUrl}>{content.ctaLabel}</a>
              </p>
            )}
          </>
        )}
        {!content.choices?.length && content.ctaLabel && ctaUrl && <LinkButton href={ctaUrl}>{content.ctaLabel} →</LinkButton>}
        <Signoff />
      </Card>
    </CardEmail>
  )
}
