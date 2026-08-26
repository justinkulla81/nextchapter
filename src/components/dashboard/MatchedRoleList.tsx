import type { MatchedRole } from '@/lib/matching/candidate-role-matches'
import { expressInterestInRole } from '@/lib/matching/express-interest-in-role'
import { formatRoleComp } from '@/lib/matching/format-comp'
import { SubmitButton } from '@/components/ui/submit-button'

const TYPE_LABEL: Record<string, string> = {
  FULL_TIME: 'Full-time',
  BOARD_PAID: 'Board (paid)',
  BOARD_UNPAID: 'Board (unpaid)',
  CONSULTING_PAID: 'Consulting (paid)',
  CONSULTING_UNPAID: 'Consulting (unpaid)',
}

export function MatchedRoleList({ roles, emptyMessage }: { roles: MatchedRole[]; emptyMessage: string }) {
  if (roles.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="space-y-3">
      {roles.map((role) => (
        <div key={role.id} className="rounded-lg border border-border bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">{role.roleTitle}</p>
              <p className="text-sm text-muted-foreground">
                {role.companyName} · {TYPE_LABEL[role.type] ?? role.type}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
              {formatRoleComp(role)}
            </span>
          </div>
          {role.description && <p className="mt-2 text-sm text-muted-foreground">{role.description}</p>}
          <form action={expressInterestInRole.bind(null, role.id)} className="mt-3">
            <SubmitButton size="sm" pendingLabel="Sending…">
              Express interest
            </SubmitButton>
          </form>
        </div>
      ))}
    </div>
  )
}
