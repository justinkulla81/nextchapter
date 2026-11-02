import { Button, Card, CardEmail, FactList, Headline, Lead, MUTED, Wordmark } from '@/lib/email/card-layout'

interface RecruiterNewCandidateAlertEmailProps {
  fullName: string
  primaryFunction: string
  level: string
  targetRoleType: string
  industry: string
  geo: string
  portalUrl: string
  unsubscribeUrl: string
}

// Sent when a candidate crosses into (opted-in AND Dossier unlocked) — see
// bucketRecruiterDatabaseRows's pendingNotify bucket. Deliberately keeps
// PII light (function/level/target role/industry/geo, no name or contact
// info) — the full profile lives behind the portal login, not in an email
// that could be forwarded.
export default function RecruiterNewCandidateAlertEmail({
  fullName,
  primaryFunction,
  level,
  targetRoleType,
  industry,
  geo,
  portalUrl,
  unsubscribeUrl,
}: RecruiterNewCandidateAlertEmailProps) {
  return (
    <CardEmail
      preheader={`A new ${targetRoleType} candidate is visible in the Recruiter Database.`}
      audience="recruiter"
      footer={<a href={unsubscribeUrl} style={{ color: MUTED }}>Unsubscribe from these alerts</a>}
    >
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>{fullName.split(' ')[0]}, a new candidate just unlocked visibility</Headline>
        <FactList
          rows={[
            { label: 'Target role', value: targetRoleType },
            { label: 'Function', value: primaryFunction },
            { label: 'Level', value: level },
            { label: 'Industry', value: industry },
            { label: 'Location', value: geo },
          ]}
        />
        <Lead>The full profile is in the Recruiter Database.</Lead>
        <Button href={portalUrl}>View the Recruiter Database</Button>
      </Card>
    </CardEmail>
  )
}
