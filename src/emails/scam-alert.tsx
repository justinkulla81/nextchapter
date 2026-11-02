import type { CSSProperties } from 'react'
import { Body, Button, Card, CardEmail, Headline, INK, MUTED, Small, Wordmark } from '@/lib/email/card-layout'

interface ScamAlertEmailProps {
  firstName: string | null
  victoriaName: 'Victoria' | 'Vicki' | 'Vic'
  level: 'LIKELY_FAKE' | 'SUSPICIOUS'
  claimedCompany: string | null
  fromAddress: string
  subjectLine: string
  reasons: string[]
  alertUrl: string
  notSpamUrl: string
  settingsUrl: string
}

// Not a link on purpose: nothing in this email should make it easier to
// click through to the suspicious message's sender or site.
const quoted: CSSProperties = {
  margin: '0 0 20px',
  padding: '16px 20px',
  backgroundColor: '#e8f0f8',
  borderRadius: '16px',
  fontSize: '15px',
  lineHeight: '1.5',
  color: MUTED,
}

const list: CSSProperties = { paddingLeft: '20px', margin: '0 0 20px', fontSize: '16px', lineHeight: '1.6', color: INK }

export default function ScamAlertEmail({
  firstName,
  victoriaName,
  level,
  claimedCompany,
  fromAddress,
  subjectLine,
  reasons,
  alertUrl,
  notSpamUrl,
  settingsUrl,
}: ScamAlertEmailProps) {
  const about = claimedCompany ? `the ${claimedCompany} email` : 'a recruiter email'
  const likelyFake = level === 'LIKELY_FAKE'
  const headline = likelyFake ? `Don't book anything yet: ${about} may be fake.` : `Pause before you reply: ${about} looks off.`

  return (
    <CardEmail
      preheader={headline}
      audience="candidate"
      footer={
        <>
          I look at recruiter and interview emails in the Gmail inbox you connected, and only keep the ones I flag.
          That&apos;s how I get better. You can also report scams at reportfraud.ftc.gov.{' '}
          <a href={settingsUrl} style={{ color: MUTED }}>Manage your Gmail connection</a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{headline}</Headline>
        <div style={{ textAlign: 'left' }}>
          <Body>
            {firstName ? `Hi ${firstName}, ` : ''}
            {victoriaName} here. I just checked a message that reached your inbox, and{' '}
            {likelyFake ? "I think it's probably a scam, but I can be wrong." : "I can't tell you it's real."} Here is what I found.
          </Body>

          <div style={quoted}>
            <div>From: {fromAddress}</div>
            <div>Subject: {subjectLine}</div>
          </div>

          <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: INK }}>Why I flagged it:</p>
          <ul style={{ ...list, marginTop: '8px' }}>
            {reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>

          <p style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: INK }}>What to do:</p>
          <ul style={{ ...list, marginTop: '8px' }}>
            <li>Don&apos;t click its links, book through them, or reply.</li>
            <li>Don&apos;t send ID, bank details, or money to anyone who contacted you this way.</li>
            {claimedCompany && (
              <li>
                If you want the real {claimedCompany} role, type the company&apos;s own website into your browser and
                apply from its careers page.
              </li>
            )}
            <li>
              Already clicked or entered something? Change that password now, and call your bank if you shared
              financial details.
            </li>
          </ul>
        </div>

        <Button href={notSpamUrl}>Not spam, this is real</Button>
        <Small>
          Or just reply to this email and tell me who they are. I read every reply, and I&apos;d rather be corrected
          than miss a real one. <a href={alertUrl} style={{ color: MUTED }}>See why I flagged it</a>
        </Small>
      </Card>
    </CardEmail>
  )
}
