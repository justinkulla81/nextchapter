import { emailStyles } from '@/lib/email/email-styles'

interface ReferenceRequestEmailProps {
  candidateName: string
  refereeName: string
  referenceUrl: string
  // PART TWO §9 — the wording must never expose that the candidate is
  // searching to a referee who might mention it. Confidential-mode framing
  // is "building a professional profile," never "job searching."
  confidentialSearchMode: boolean
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

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

export default function ReferenceRequestEmail({
  candidateName,
  refereeName,
  referenceUrl,
  confidentialSearchMode,
}: ReferenceRequestEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {refereeName},</p>
      {confidentialSearchMode ? (
        <p>
          {candidateName} is putting together a professional profile on NextChapter and asked
          whether you&apos;d be willing to share your perspective on working with them — how they
          operate, not whether they&apos;re looking for anything new.
        </p>
      ) : (
        <p>
          {candidateName} is job searching right now, and named you as a reference on NextChapter —
          a hiring platform for people between chapters of their career. A few minutes of your time
          sharing what it was like working with {candidateName} will really help them out.
        </p>
      )}
      <p>
        It takes about 15 minutes — a handful of ratings and a couple of short written notes. Your
        answers save as you go, so it&apos;s fine to finish it in more than one sitting.
      </p>
      <a href={referenceUrl} style={button}>
        Leave a reference for {candidateName}
      </a>
      <p style={footer}>
        If you weren&apos;t expecting this, you can safely ignore this email. Your response is
        only shared with {candidateName} in summary form — employers only ever see a short
        written summary, never your raw ratings.
      </p>
    </div>
  )
}
