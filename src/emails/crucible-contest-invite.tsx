import { Button, Card, CardEmail, Headline, Lead, MUTED } from '@/lib/email/card-layout'

interface CrucibleContestInviteEmailProps {
  companyName: string
  contestTitle: string
  entryUrl: string
}

// Own the visible sender name below (see send-crucible-contest-invite.ts's
// comment on why the underlying domain is still launchyournextchapter.com)
// — this is the one place a candidate actually sees the brand, so this email
// keeps its own wordmark instead of the shared NextChapter one.
function ContestWordmark() {
  return (
    <p style={{ margin: '0 0 28px', fontSize: '22px', fontWeight: 700, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
      <span style={{ color: '#7A9900' }}>no</span>
      <span style={{ color: '#6b7280', fontWeight: 400 }}>experience</span>
      <span style={{ color: '#C2168A' }}>needed</span>
      <span style={{ color: '#1478C8' }}>.ai</span>
    </p>
  )
}

export default function CrucibleContestInviteEmail({
  companyName,
  contestTitle,
  entryUrl,
}: CrucibleContestInviteEmailProps) {
  return (
    <CardEmail
      audience="candidate"
      preheader={`${companyName} posted a contest: ${contestTitle}`}
      footer={<span style={{ color: MUTED }}>This is a one-time invite link tied to your assessment result — no password, no account required.</span>}
    >
      <Card center pad="28px 32px 36px">
        <ContestWordmark />
        <Headline>You passed — and an employer wants your take on something real.</Headline>
        <Lead>
          <strong>{companyName}</strong> posted a contest: <strong>{contestTitle}</strong>. Submit your idea for a
          shot at a tailored, paid hire. No account needed.
        </Lead>
        <Button href={entryUrl}>View the contest</Button>
      </Card>
    </CardEmail>
  )
}
