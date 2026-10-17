import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'
import type { OutplacementProgramType } from '@prisma/client'
import { PROGRAM_TYPE_BENEFIT } from '@/lib/employer/program-type'

interface OutplacementSeatLinkedEmailProps {
  orgName: string
  programType?: OutplacementProgramType
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

// Sent when the enrolled email already had a registered NextChapter
// account — the seat links immediately (no invite/activation step needed),
// so this is a notice, not a call to action. No login link, since the
// recipient already knows how to log in.
export default function OutplacementSeatLinkedEmail({ orgName, programType = 'OUTPLACEMENT' }: OutplacementSeatLinkedEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi there,</p>
      <p>
        {orgName} has set up a NextChapter {PROGRAM_TYPE_BENEFIT[programType]} benefit for your account. Your plan now includes
        everything in that benefit — nothing about your existing activity, history, or settings changed.
        {orgName} never sees your individual activity on NextChapter, only anonymous, aggregate participation
        numbers across everyone enrolled.
      </p>
      <p style={footer}>If you weren&apos;t expecting this, contact support.</p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
