import { Button, Card, CardEmail, CardGap, Headline, Hero, MUTED, Wordmark } from '@/lib/email/card-layout'

interface DigestCandidate {
  primaryFunction: string
  level: string
  targetRoleType: string
  industry: string
  geo: string
}

interface RecruiterDailyDigestEmailProps {
  fullName: string
  candidates: DigestCandidate[]
  portalUrl: string
  unsubscribeUrl: string
}

export default function RecruiterDailyDigestEmail({
  fullName,
  candidates,
  portalUrl,
  unsubscribeUrl,
}: RecruiterDailyDigestEmailProps) {
  const plural = candidates.length === 1 ? '' : 's'
  return (
    <CardEmail
      preheader={`${candidates.length} new A-grade candidate${plural} in the Recruiter Database today.`}
      audience="recruiter"
      footer={<a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe from these alerts</a>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{fullName.split(' ')[0]}, new candidates unlocked visibility today</Headline>
        <Hero value={String(candidates.length)} caption={`new A-grade candidate${plural} in the Recruiter Database`} />
        <Button href={portalUrl}>View &amp; message candidates</Button>
      </Card>
      <CardGap />
      {candidates.map((c, i) => (
        <Card key={i} pad="20px 32px">
          <p style={{ margin: 0, fontSize: '17px', color: '#202124' }}>
            <strong>{c.targetRoleType}</strong> · {c.primaryFunction} · {c.level}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '15px', color: MUTED }}>
            {c.industry} · {c.geo}
          </p>
        </Card>
      )).flatMap((row, i) => [row, <CardGap key={`gap-${i}`} />])}
    </CardEmail>
  )
}
