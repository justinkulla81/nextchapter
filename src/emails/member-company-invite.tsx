import { emailStyles } from '@/lib/email/email-styles'

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
        {orgName} has given {companyName} access to local job seekers in its program: people who chose to share a verified profile with hiring member companies.
        You can see their profiles and ask for an introduction. Each person says yes or no.
      </p>
      <p>
        <a href={acceptUrl} style={button}>
          Open your access
        </a>
      </p>
      <p style={footer}>This link signs you in once. If you weren&apos;t expecting it, you can ignore this email.</p>
    </div>
  )
}
