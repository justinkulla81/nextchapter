import { emailStyles } from '@/lib/email/email-styles'
import type { RoleMatchEmailRole } from '@/lib/email/send-role-match-email'
import { AudienceTag } from '@/lib/email/audience-tag'

interface RoleMatchEmailProps {
  firstName: string | null
  role: RoleMatchEmailRole
  actionUrl: string
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

const ROLE_TYPE_LABEL: Record<RoleMatchEmailRole['type'], string> = {
  FULL_TIME: 'full-time role',
  BOARD_PAID: 'paid board seat',
  BOARD_UNPAID: 'board advisory opportunity',
  CONSULTING_PAID: 'paid consulting opportunity',
  CONSULTING_UNPAID: 'consulting opportunity',
}

export default function RoleMatchEmail({ firstName, role, actionUrl }: RoleMatchEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>Hi {firstName || 'there'},</p>
      {/* Every member sees every job (owner's rule, 2026-10-16), so the role is always named. */}
      <>
          <p>
            A {ROLE_TYPE_LABEL[role.type]} at <strong>{role.companyName}</strong> is a strong match for your
            background: <strong>{role.roleTitle}</strong>.
          </p>
          {role.description && <p>{role.description}</p>}
          <p>{role.compLabel}</p>
          <a href={actionUrl} style={button}>
            See the opportunity →
          </a>
      </>
      <AudienceTag audience="candidate" />
    </div>
  )
}
