import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

interface Props {
  orgName: string
  companyName: string
  acceptUrl: string
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
const button: React.CSSProperties = { display: 'inline-block', background: '#0b2545', color: '#ffffff', padding: '10px 18px', borderRadius: '6px', textDecoration: 'none', fontWeight: 600 }
const footer: React.CSSProperties = { marginTop: '32px', ...emailStyles.muted }

// A workforce org invites a hiring member company to see local job seekers
// who chose to share their Dossier.
export default function MemberCompanyInviteEmail({ orgName, companyName, acceptUrl }: Props) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi there,</p>
      <p>
        {orgName} has given {companyName} access to its member portal. When you have a layoff, ask for free career-support seats for your people and see how they&apos;re doing
        (counts only). When you&apos;re hiring, meet local job seekers who chose to share a verified profile, and ask for an introduction. Each person says yes or no.
      </p>
      <p>
        <a href={acceptUrl} style={button}>
          Open your company portal
        </a>
      </p>
      <p style={footer}>This link signs you in once. If you weren&apos;t expecting it, you can ignore this email.</p>
      <AudienceTag audience="employer" />
    </div>
  )
}
