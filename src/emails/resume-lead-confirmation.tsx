import { emailCtaLabel } from '@/lib/ab/email-cta'
import type { NavCtaVariant } from '@/lib/ab/nav-cta'
import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface ResumeLeadConfirmationEmailProps {
  fullName: string
  /** The recipient's arm of the assessment button label test. */
  ctaVariant?: NavCtaVariant
}

export default function ResumeLeadConfirmationEmail({ fullName, ctaVariant }: ResumeLeadConfirmationEmailProps) {
  const firstName = fullName.split(' ')[0] || 'there'
  return (
    <CardEmail
      preheader="Got your resume — thanks for sending it over."
      audience="candidate"
      footer={<span style={{ color: MUTED }}>We&apos;ll also send occasional NextChapter updates. Unsubscribe anytime.</span>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>Hi {firstName}, got your resume — thanks for sending it over</Headline>
        <Lead>
          We review submissions and pass strong matches along to recruiters in our network. There&apos;s no guaranteed timeline and not every
          submission gets forwarded, but if a recruiter wants to follow up, they&apos;ll reach out at this email address directly.
        </Lead>
        <Lead>
          In the meantime, a free Market Reality Assessment, plus a personalized action plan, is the fastest way to strengthen your search on your own.
        </Lead>
        <Button campaign="resume_confirmation" href="https://launchyournextchapter.com/onboarding/desire" ctaVariant={ctaVariant}>{emailCtaLabel(ctaVariant, 'Get your free assessment')}</Button>
      </Card>
    </CardEmail>
  )
}
