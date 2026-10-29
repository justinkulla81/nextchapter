import { emailStyles } from '@/lib/email/email-styles'
import { AudienceTag } from '@/lib/email/audience-tag'

interface JourneyPlanEmailProps {
  situationLabel: string
  intro: string
  steps: string[]
  startUrl: string
  unsubscribeUrl: string
  /** The school they picked on a company page and asked to be listed with (its page on this site, when it has one). */
  school?: { name: string; url: string | null }
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
  backgroundColor: '#f4a259',
  color: '#0b2545',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 600,
}
const footer: React.CSSProperties = { marginTop: '32px', ...emailStyles.muted }

/** The one-time first-week plan for someone who told us where they are on the homepage. */
export default function JourneyPlanEmail({ situationLabel, intro, steps, startUrl, unsubscribeUrl, school }: JourneyPlanEmailProps) {
  return (
    <div style={container}>
      <p style={logo}>NextChapter</p>
      <p>
        <strong>Your first week: {situationLabel}</strong>
      </p>
      <p>{intro}</p>
      <ol>
        {steps.map((s) => (
          <li key={s} style={{ marginBottom: '8px' }}>
            {s}
          </li>
        ))}
      </ol>
      {school && (
        <p>
          <strong>Your school: {school.name}.</strong> {school.url && <><a href={school.url}>See its page</a>. </>}You are on its alumni list. Make a free account and add {school.name} to your profile: when five alumni are on NextChapter, the alumni network appears on your Network page.
        </p>
      )}
      <p>The last step takes about five minutes and is free. It gives you a plan for the weeks after this one.</p>
      <a href={startUrl} style={button}>
        Get your Market Reality Assessment →
      </a>
      <p style={footer}>
        You asked for this plan at launchyournextchapter.com. This is the only email we send unless you ask for more.{' '}
        <a href={unsubscribeUrl}>Unsubscribe</a>
      </p>
      <AudienceTag audience="candidate" />
    </div>
  )
}
