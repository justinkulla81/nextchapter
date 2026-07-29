import { emailStyles } from '@/lib/email/email-styles'

interface EmployerReferenceInviteEmailProps {
  managerName: string
  managerCompany: string
  employeeFirstName: string
  claimUrl: string
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
  marginTop: '16px',
  padding: '12px 20px',
  backgroundColor: '#2e7d5b',
  color: '#ffffff',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}

const footer: React.CSSProperties = {
  marginTop: '32px',
  ...emailStyles.muted,
}

// Prompt 65 section 6 — deliberately warmer and more specific than any
// cold-outreach template elsewhere in the app: this is a real, named
// person vouching for the recipient, not a marketing send. Nothing about
// the reference itself is visible until they follow this link and
// explicitly accept it (see the consent model in Prompt 65 section 1).
export default function EmployerReferenceInviteEmail({
  managerName,
  managerCompany,
  employeeFirstName,
  claimUrl,
}: EmployerReferenceInviteEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {employeeFirstName},</p>
      <p>
        {managerName} at {managerCompany} wanted to make sure you landed well — they left you a
        reference and an invitation to NextChapter, a free platform that turns a job search into a
        structured, coached plan.
      </p>
      <p>
        Nothing from their reference is used or shared anywhere until you&apos;ve seen it yourself and
        chosen to accept it.
      </p>
      <a href={claimUrl} style={button}>
        Review {managerName.split(' ')[0]}&apos;s reference →
      </a>
      <p style={footer}>If you weren&apos;t expecting this, you can ignore this email.</p>
    </div>
  )
}
