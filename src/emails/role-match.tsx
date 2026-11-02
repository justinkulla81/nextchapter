import type { RoleMatchEmailRole } from '@/lib/email/send-role-match-email'
import { Button, Card, CardEmail, FactList, Headline, Lead, Wordmark } from '@/lib/email/card-layout'

interface RoleMatchEmailProps {
  firstName: string | null
  role: RoleMatchEmailRole
  actionUrl: string
}

const ROLE_TYPE_LABEL: Record<RoleMatchEmailRole['type'], string> = {
  FULL_TIME: 'full-time role',
  BOARD_PAID: 'paid board seat',
  BOARD_UNPAID: 'board advisory opportunity',
  CONSULTING_PAID: 'paid consulting opportunity',
  CONSULTING_UNPAID: 'consulting opportunity',
}

export default function RoleMatchEmail({ role, actionUrl }: RoleMatchEmailProps) {
  // Every member sees every job (owner's rule, 2026-10-16), so the role is always named.
  return (
    <CardEmail preheader={`${role.verdict}: ${role.roleTitle} at ${role.companyName}`} audience="candidate">
      <Card center pad="28px 32px 36px">
        <Wordmark />
        <Headline>
          {role.verdict}: {role.roleTitle} at {role.companyName}
        </Headline>
        <FactList
          rows={[
            { label: 'Company', value: role.companyName },
            { label: 'Type', value: ROLE_TYPE_LABEL[role.type] },
            { label: 'Pay', value: role.compLabel },
          ]}
        />
        {role.description && <Lead>{role.description}</Lead>}
        <Button href={actionUrl}>See the opportunity</Button>
      </Card>
    </CardEmail>
  )
}
