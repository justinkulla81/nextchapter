import { emailStyles } from '@/lib/email/email-styles'

export type SprintGoalReminderVariant = 'open' | 'reminder' | 'final'

interface SprintGoalReminderEmailProps {
  firstName: string | null
  pointsTarget: number
  variant: SprintGoalReminderVariant
  dashboardUrl: string
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

const COPY: Record<
  SprintGoalReminderVariant,
  { subject: (name: string) => string; heading: string; body: (points: number) => string; cta: string }
> = {
  open: {
    subject: (name) => `Set your Search Actions for this week, ${name}`,
    heading: 'A new week, a new plan.',
    body: (points) =>
      `This week's target is ${points} points. Pick your Search Actions for the week — you have until Monday at 12:01pm PT to set or change them.`,
    cta: 'Set this week’s Search Actions →',
  },
  reminder: {
    subject: () => "You haven't set this week's Search Actions yet",
    heading: '12 hours until lock.',
    body: (points) =>
      `You haven't set this week's Search Actions yet — this week's target is ${points} points. You have until Monday at 12:01pm PT before we lock in a default mix for you.`,
    cta: 'Set this week’s Search Actions →',
  },
  final: {
    subject: () => 'Your Search Actions lock in about an hour',
    heading: 'Almost locked in.',
    body: (points) =>
      `Your Search Actions for this week (target: ${points} points) lock in about an hour. Set them now, or we'll use our suggested mix for you automatically.`,
    cta: 'Set this week’s Search Actions →',
  },
}

export default function SprintGoalReminderEmail({
  firstName,
  pointsTarget,
  variant,
  dashboardUrl,
  unsubscribeUrl,
}: SprintGoalReminderEmailProps) {
  const copy = COPY[variant]
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p style={{ fontWeight: 600, fontSize: '18px', marginTop: '24px' }}>{copy.heading}</p>
      <p>{firstName ? `Hi ${firstName}, ` : ''}{copy.body(pointsTarget)}</p>
      <a href={dashboardUrl} style={button}>
        {copy.cta}
      </a>
      <p style={footer}>
        <a href={unsubscribeUrl} style={{ color: '#4a5568' }}>
          Unsubscribe from these reminders
        </a>
      </p>
    </div>
  )
}
