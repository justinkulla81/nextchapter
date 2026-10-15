import { emailStyles } from '@/lib/email/email-styles'

interface DocumentRequestedEmailProps {
  requesterLabel: string
  title: string
  instructions: string | null
  dueLabel: string | null
  uploadUrl: string
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
const footer: React.CSSProperties = { marginTop: '32px', ...emailStyles.muted }

export default function DocumentRequestedEmail({ requesterLabel, title, instructions, dueLabel, uploadUrl }: DocumentRequestedEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi,</p>
      <p>
        {requesterLabel} asked you for a document: <strong>{title}</strong>.
        {dueLabel ? ` They would like it by ${dueLabel}.` : ''}
      </p>
      {instructions ? <p style={{ whiteSpace: 'pre-wrap' }}>{instructions}</p> : null}
      <a href={uploadUrl} style={button}>
        Upload the document
      </a>
      <p style={footer}>You can upload from your NextChapter dashboard under Documents. If you were not expecting this, you can ignore this email.</p>
    </div>
  )
}
