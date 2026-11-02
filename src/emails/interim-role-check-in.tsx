import { Button, Card, CardEmail, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface InterimRoleCheckInEmailProps {
  firstName: string | null
  companyName: string | null
  stillActiveUrl: string
  endedUrl: string
}

export default function InterimRoleCheckInEmail({
  firstName,
  companyName,
  stillActiveUrl,
  endedUrl,
}: InterimRoleCheckInEmailProps) {
  const roleLabel = companyName ? `at ${companyName}` : 'your interim work'

  return (
    <CardEmail audience="candidate" preheader="Quick check so your resume and Dossier stay accurate.">
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          {firstName ? `Hi ${firstName} — ` : ''}still doing {roleLabel}?
        </Headline>
        <Lead>
          Quick check so your resume and Dossier stay accurate — nothing else to do here beyond picking one of these.
        </Lead>
        <Button href={stillActiveUrl}>Yes, still active</Button>
        <p style={{ margin: '20px 0 0', fontSize: '15px' }}>
          <a href={endedUrl} style={{ color: MUTED, textDecoration: 'underline' }}>
            No, it&apos;s ended
          </a>
        </p>
      </Card>
    </CardEmail>
  )
}
