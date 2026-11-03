import { emailCtaLabel } from '@/lib/ab/email-cta'
import type { NavCtaVariant } from '@/lib/ab/nav-cta'
import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface JourneyPlanEmailProps {
  situationLabel: string
  intro: string
  steps: string[]
  startUrl: string
  unsubscribeUrl: string
  /** The school they picked on a company page and asked to be listed with (its page on this site, when it has one). */
  school?: { name: string; url: string | null }
  /** The recipient's arm of the assessment button label test. */
  ctaVariant?: NavCtaVariant
}

/** The one-time first-week plan for someone who told us where they are on the homepage. */
export default function JourneyPlanEmail({ situationLabel, intro, steps, startUrl, unsubscribeUrl, school, ctaVariant }: JourneyPlanEmailProps) {
  return (
    <CardEmail
      preheader={intro}
      audience="candidate"
      footer={
        <>
          Know someone else affected? Forward this email, or send them <a href="https://launchyournextchapter.com/?utm_source=forward" style={{ color: MUTED }}>launchyournextchapter.com</a>.
          <br />
          You asked for this plan at launchyournextchapter.com. This is the only email we send unless you ask for more.
          <br />
          <a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe</a>
        </>
      }
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Your first week: {situationLabel}</Headline>
        <Lead>{intro}</Lead>
        <div style={{ textAlign: 'left', margin: '0 auto 28px', maxWidth: '500px', fontSize: '17px', lineHeight: '1.6' }}>
          <ol style={{ paddingLeft: '20px', margin: 0 }}>
            {steps.map((s) => (
              <li key={s} style={{ marginBottom: '8px' }}>
                {s}
              </li>
            ))}
          </ol>
        </div>
        {school && (
          <Lead>
            <strong>Your school: {school.name}.</strong> {school.url && <><a href={school.url}>See its page</a>. </>}You are on its alumni list. Make a free account and add {school.name} to your profile: when five alumni are on NextChapter, the alumni network appears on your Network page.
          </Lead>
        )}
        <Lead>The last step takes about five minutes and is free. It gives you a plan for the weeks after this one.</Lead>
        <Button campaign="journey_plan" href={startUrl} ctaVariant={ctaVariant}>{emailCtaLabel(ctaVariant, 'Get your Market Reality Assessment')}</Button>
      </Card>
    </CardEmail>
  )
}
