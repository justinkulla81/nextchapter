import { BRAND, Body, Card, CardEmail, Headline, LinkButton, MUTED, Signoff, Wordmark } from '@/lib/email/card-layout'
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

const jobRow: React.CSSProperties = { padding: '14px 0', borderTop: '1px solid #e5e7eb' }

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
        <Wordmark label="A note from NextChapter" />
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
        {content.jobs && content.jobs.length > 0 && (
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: '0 0 20px', borderBottom: '1px solid #e5e7eb' }}>
            <tbody>
              {content.jobs.map((j) => (
                <tr key={j.url}>
                  <td style={jobRow}>
                    <a href={j.url} style={{ fontSize: '17px', fontWeight: 600, color: BRAND, textDecoration: 'underline' }}>
                      {j.title}
                    </a>
                    <p style={{ margin: '4px 0 0', fontSize: '15px', color: MUTED }}>{[j.company, j.place].filter(Boolean).join(' · ')}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {content.feature && (
          <div style={{ margin: '0 0 20px', padding: '16px 0', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
            <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: MUTED }}>{content.feature.kicker}</p>
            <p style={{ margin: '0 0 8px', fontSize: '19px', fontWeight: 700, lineHeight: '1.35', color: BRAND }}>{content.feature.title}</p>
            <p style={{ margin: '0 0 10px', fontSize: '16px', lineHeight: '1.6', color: '#202124' }}>{content.feature.body}</p>
            <a href={content.feature.url} style={{ fontSize: '16px', fontWeight: 600, color: BRAND, textDecoration: 'underline' }}>
              {content.feature.linkLabel}
            </a>
          </div>
        )}
        {content.afterJobs && <Body>{content.afterJobs}</Body>}
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
