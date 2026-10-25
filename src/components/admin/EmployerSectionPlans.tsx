'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { setEnterpriseAction, setWorkspacePlanAction } from '@/app/support/admin/(portal)/organizations/actions'

export interface SectionPlanRow {
  workspaceId: string
  label: string
  employees: string
  status: string
  plan: string
  planNote: string | null
  planUpdatedAt: string | null
}

export interface PlanOption {
  key: string
  label: string
  means: string
}

// Plans are four options, so they are adjacent buttons. The enterprise package covers every section; turning it off asks
// first, because sections marked Enterprise go back to Free.
export function EmployerSectionPlans({ organizationId, enterprise, enterpriseSince, rows, plans }: { organizationId: string; enterprise: boolean; enterpriseSince: string | null; rows: SectionPlanRow[]; plans: PlanOption[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmOff, setConfirmOff] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  const run = (fn: () => Promise<{ error?: string }>, done: string) =>
    start(async () => {
      setError(null)
      setSaved(null)
      const r = await fn()
      if (r.error) setError(r.error)
      else setSaved(done)
      router.refresh()
    })

  return (
    <div className={cn('space-y-6', pending && 'cursor-wait')}>
      <div className="space-y-2 rounded-md border border-border p-3 text-sm">
        <p className="font-medium">Enterprise package</p>
        <p className="text-muted-foreground">
          {enterprise
            ? `On${enterpriseSince ? ` since ${enterpriseSince}` : ''}. It covers every section below for people who already hold a role there. It does not give anyone a role.`
            : 'Off. Turn it on when the organization has bought the package covering Hiring, Employees and Outplacement.'}
        </p>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Enterprise package">
          <button
            type="button"
            disabled={pending}
            aria-pressed={enterprise}
            onClick={() => run(() => setEnterpriseAction(organizationId, true), 'Enterprise package turned on.')}
            className={cn('rounded-md border px-3 py-1.5 text-sm font-medium', enterprise ? 'border-navy bg-navy text-white' : 'border-border hover:bg-muted')}
          >
            On
          </button>
          <button
            type="button"
            disabled={pending}
            aria-pressed={!enterprise}
            onClick={() => (enterprise ? setConfirmOff(true) : undefined)}
            className={cn('rounded-md border px-3 py-1.5 text-sm font-medium', !enterprise ? 'border-navy bg-navy text-white' : 'border-border hover:bg-muted')}
          >
            Off
          </button>
        </div>
        {confirmOff && enterprise && (
          <div role="alertdialog" aria-label="Turn off the enterprise package" className="space-y-2 rounded-md border border-destructive/40 p-3">
            <p>Sections marked Enterprise go back to Free, and you then choose the plan each one is on. Turn it off?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmOff(false)
                  run(() => setEnterpriseAction(organizationId, false), 'Enterprise package turned off.')
                }}
                disabled={pending}
                className="rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white"
              >
                Turn off enterprise
              </button>
              {/* Cancel takes the default focus, so Enter never confirms. */}
              <button type="button" autoFocus onClick={() => setConfirmOff(false)} className="rounded-md border border-border px-3 py-1.5 text-sm font-medium">
                Keep it on
              </button>
            </div>
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">This organization has no Hiring, Employees or Outplacement section yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.workspaceId} className="space-y-2 rounded-md border border-border p-3 text-sm">
              <p className="font-medium">
                {r.label} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">{r.status.toLowerCase()}</span>
                <span className="ml-2 text-xs font-normal text-muted-foreground">{r.employees}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`Plan for ${r.label}`}>
                {plans.map((p) => {
                  const selected = r.plan === p.key
                  const blocked = p.key === 'ENTERPRISE' && !enterprise
                  return (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={selected}
                      disabled={pending || blocked}
                      title={blocked ? 'Turn on the enterprise package first.' : p.means}
                      onClick={() => !selected && run(() => setWorkspacePlanAction(r.workspaceId, p.key, null), `${r.label} is now on the ${p.label} plan.`)}
                      className={cn('rounded-md border px-3 py-1.5 text-sm font-medium', selected ? 'border-navy bg-navy text-white' : 'border-border hover:bg-muted', blocked && 'opacity-50')}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {plans.find((p) => p.key === r.plan)?.means}
                {r.planUpdatedAt ? ` Set by staff on ${r.planUpdatedAt}.` : ''}
                {r.planNote ? ` Note: ${r.planNote}` : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
      {!enterprise && rows.length > 0 && <p className="text-xs text-muted-foreground">The Enterprise plan is greyed out until the enterprise package above is turned on.</p>}
      {saved && <p role="status" className="text-sm text-success">{saved}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
