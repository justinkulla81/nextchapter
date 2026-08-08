import { emailStyles } from '@/lib/email/email-styles'

interface AdminResumeUploadedEmailProps {
  candidateName: string
  fileName: string
  adminUrl: string
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

export default function AdminResumeUploadedEmail({
  candidateName,
  fileName,
  adminUrl,
}: AdminResumeUploadedEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter Admin</p>
      <p>{candidateName} uploaded a resume: {fileName}</p>
      <a href={adminUrl} style={button}>
        View candidate →
      </a>
    </div>
  )
}
