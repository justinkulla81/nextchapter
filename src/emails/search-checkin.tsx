import { emailStyles } from '@/lib/email/email-styles'

interface SearchCheckInEmailProps {
  firstName: string | null
  introCopy?: string | null
  stillSearchingUrl: string
  takingABreakUrl: string
  gotAnOfferUrl: string
  pixelUrl: string
  unsubscribeUrl: string
}

const container: React.CSSProperties = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
  maxWidth: '480px',
  margin: '0 auto',
  padding: '32px 24px',
  color: '#0a0a0a',
  ...emailStyles.body,
  fontSize: '15px',
}

const logo: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#0b2545',
}

const buttonBase: React.CSSProperties = {
  display: 'block',
  textAlign: 'center',
  textDecoration: 'none',
  padding: '12px 20px',
  borderRadius: '8px',
  marginTop: '10px',
  ...emailStyles.cta,
}

const primaryButton: React.CSSProperties = { ...buttonBase, backgroundColor: '#1d4e89', color: '#ffffff' }
const neutralButton: React.CSSProperties = { ...buttonBase, backgroundColor: '#e2e8f0', color: '#0a0a0a' }
const successButton: React.CSSProperties = { ...buttonBase, backgroundColor: '#2e7d5b', color: '#ffffff' }

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

// Saturday's check-in — a single question with three answers, each its own
// no-login link (/api/checkin/[token]) so answering takes one click, not a
// form. See overlap with Sunday's Finish Line email, which now carries the
// old "week in review" content this replaces on Saturday.
export default function SearchCheckInEmail({
  firstName,
  introCopy,
  stillSearchingUrl,
  takingABreakUrl,
  gotAnOfferUrl,
  pixelUrl,
  unsubscribeUrl,
}: SearchCheckInEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>
        Are you still searching{firstName ? `, ${firstName}` : ''}?
      </p>
      <p>
        Just checking in — one click tells us where you are this week, so we can point everything
        else (your action plan, your emails from us) at what&apos;s actually true right now.
      </p>
      {introCopy && <p>{introCopy}</p>}

      <a href={stillSearchingUrl} style={primaryButton}>
        Yes, still searching
      </a>
      <a href={takingABreakUrl} style={neutralButton}>
        Taking a break
      </a>
      <a href={gotAnOfferUrl} style={successButton}>
        Got an offer! 🎉
      </a>

      <p style={footer}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Turn off these weekly nudges
        </a>
      </p>
      {/* Best-effort open signal — many mail clients block remote images by
          default, so this undercounts opens rather than overcounting. */}
      <img src={pixelUrl} width={1} height={1} alt="" style={{ display: 'none' }} />
    </div>
  )
}
