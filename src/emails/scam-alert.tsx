import { emailStyles } from '@/lib/email/email-styles'

interface ScamAlertEmailProps {
  firstName: string | null
  victoriaName: 'Victoria' | 'Vicki' | 'Vic'
  level: 'LIKELY_FAKE' | 'SUSPICIOUS'
  claimedCompany: string | null
  fromAddress: string
  subjectLine: string
  reasons: string[]
  alertUrl: string
  settingsUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}

const logo: React.CSSProperties = { fontSize: '20px', fontWeight: 700, color: '#0b2545' }

// Not a link on purpose: nothing in this email should make it easier to
// click through to the suspicious message's sender or site.
const quoted: React.CSSProperties = {
  margin: '16px 0',
  padding: '12px 16px',
  backgroundColor: '#f4f6f8',
  borderRadius: '8px',
  ...emailStyles.muted,
}

const list: React.CSSProperties = { paddingLeft: '20px', marginTop: '8px' }

const button: React.CSSProperties = {
  display: 'inline-block',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '16px',
  ...emailStyles.cta,
}

const footer: React.CSSProperties = { marginTop: '32px', ...emailStyles.muted }

export default function ScamAlertEmail({
  firstName,
  victoriaName,
  level,
  claimedCompany,
  fromAddress,
  subjectLine,
  reasons,
  alertUrl,
  settingsUrl,
}: ScamAlertEmailProps) {
  const about = claimedCompany ? `the ${claimedCompany} email` : 'a recruiter email'
  const likelyFake = level === 'LIKELY_FAKE'

  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>
        {likelyFake ? `Don't book anything yet: ${about} looks fake.` : `Pause before you reply: ${about} looks off.`}
      </p>
      <p>
        {firstName ? `Hi ${firstName}, ` : ''}
        {victoriaName} here. I just checked a message that reached your inbox, and{' '}
        {likelyFake ? "I'm fairly sure it's a scam." : "I can't tell you it's real."} Here is what I found.
      </p>

      <div style={quoted}>
        <div>From: {fromAddress}</div>
        <div>Subject: {subjectLine}</div>
      </div>

      <p style={{ marginBottom: 0 }}>Why I flagged it:</p>
      <ul style={list}>
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      <p style={{ marginBottom: 0 }}>What to do:</p>
      <ul style={list}>
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

      <a href={alertUrl} style={button}>
        See why I flagged it
      </a>

      <p style={footer}>
        I look at recruiter and interview emails in the Gmail inbox you connected, and only keep the ones I flag.
        If this one is actually legitimate, open the link above and tell me so. That&apos;s how I get better.
        You can also report scams at reportfraud.ftc.gov. <a href={settingsUrl}>Manage your Gmail connection</a>
      </p>
    </div>
  )
}
