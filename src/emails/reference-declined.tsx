import { emailStyles } from '@/lib/email/email-styles'

interface ReferenceDeclinedEmailProps {
  candidateName: string
  refereeName: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

// Sent to the candidate the moment a referee self-declines via /ref/[token]
// — a quiet, factual notice, not a rejection framed as bad news. The
// referee's own decline reason (if given) is theirs to explain privately,
// not forwarded verbatim here.
export default function ReferenceDeclinedEmail({ candidateName, refereeName }: ReferenceDeclinedEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {candidateName},</p>
      <p>
        {refereeName} let us know they&apos;re not able to leave you a reference right now. This
        happens for all kinds of reasons that have nothing to do with you — timing, company policy,
        just being swamped.
      </p>
      <p>Worth reaching out to them directly if you want the full story, or asking someone else instead.</p>
      <p style={footer}>You can see the status of all your references any time on your References page.</p>
    </div>
  )
}
