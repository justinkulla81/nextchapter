import type { CSSProperties } from 'react'
import { Button, Card, CardEmail, CardGap, Headline, INK, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface FinishLineEmailProps {
  firstName: string | null
  victoriaName: 'Victoria' | 'Vicki' | 'Vic'
  introCopy: string | null
  bullets: string[]
  checkIn?: { stillSearchingUrl: string; managingMyCareerUrl: string; gotAnOfferUrl: string } | null
  dashboardUrl?: string
  appUrl: string
  unsubscribeUrl: string
}

const bulletList: CSSProperties = { paddingLeft: '20px', margin: '0 0 28px', fontSize: '16px', lineHeight: '1.6', color: INK }
const bulletItem: CSSProperties = { marginTop: '8px' }

export default function FinishLineEmail({
  firstName,
  victoriaName,
  introCopy,
  bullets,
  checkIn = null,
  dashboardUrl,
  appUrl,
  unsubscribeUrl,
}: FinishLineEmailProps) {
  return (
    <CardEmail
      preheader="Your week in review"
      audience="candidate"
      footer={
        <>
          Don&apos;t want daily emails?{' '}
          <a href={unsubscribeUrl} style={{ color: MUTED }}>
            Turn them off
          </a>
          .
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          Hi {firstName || 'there'} — {victoriaName} here.
        </Headline>
        <p style={{ margin: '-8px 0 24px', fontSize: '13px', letterSpacing: '0.03em', textTransform: 'uppercase', color: MUTED }}>
          Your week in review
        </p>
        {introCopy && <Lead>{introCopy}</Lead>}
        <div style={{ textAlign: 'left' }}>
          <ul style={bulletList}>
            {bullets.map((bullet, i) => (
              <li key={i} style={bulletItem}>
                {bullet}
              </li>
            ))}
          </ul>
        </div>
        <Button href={dashboardUrl ?? `${appUrl}/dashboard`}>Open my dashboard</Button>
      </Card>
      {checkIn && (
        <>
          <CardGap />
          <Card pad="24px 32px">
            <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: INK }}>
              One tap, so we send the right things: where are you in your search?
            </p>
            <ul style={{ ...bulletList, margin: '8px 0 0' }}>
              <li style={bulletItem}><a href={checkIn.stillSearchingUrl} style={{ color: INK }}>Still searching</a></li>
              <li style={bulletItem}><a href={checkIn.managingMyCareerUrl} style={{ color: INK }}>Managing my career, not actively searching</a></li>
              <li style={bulletItem}><a href={checkIn.gotAnOfferUrl} style={{ color: INK }}>I got an offer</a></li>
            </ul>
          </Card>
        </>
      )}
    </CardEmail>
  )
}
