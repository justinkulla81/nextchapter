'use client'

import { useActionState, useState } from 'react'
import type { PlanBillingPeriod, PlanCatalogCategory } from '@prisma/client'
import type { FormState } from '@/app/support/admin/(portal)/plan-catalog/actions'
import { PLAN_KEYS, PLAN_LABELS, PLAN_CATEGORY_LABELS, BILLING_PERIOD_LABELS, type PlanKey } from '@/lib/constants/plan-catalog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

const CATEGORIES: PlanCatalogCategory[] = ['OUTPLACEMENT', 'DIRECT_TO_CONSUMER', 'MEMBERSHIP']
const BILLING_PERIODS: PlanBillingPeriod[] = ['NONE', 'ONE_TIME', 'MONTHLY', 'ANNUAL']

// planKey prefix -> default category, so picking a plan pre-selects a
// sensible category instead of forcing the admin to also reason about it.
function defaultCategoryFor(planKey: PlanKey): PlanCatalogCategory {
  if (planKey.startsWith('outplacement_')) return 'OUTPLACEMENT'
  if (planKey.startsWith('dtc_')) return 'DIRECT_TO_CONSUMER'
  return 'MEMBERSHIP'
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

export function PlanCatalogForm({ action }: { action: (prevState: FormState, formData: FormData) => Promise<FormState> }) {
  const [state, formAction, pending] = useActionState(action, undefined)
  const [planKey, setPlanKey] = useState<PlanKey>(PLAN_KEYS[0])

  return (
    <form
      action={formAction}
      className={cn('space-y-4 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="planKey">Plan</Label>
          <select
            id="planKey"
            name="planKey"
            required
            value={planKey}
            onChange={(e) => setPlanKey(e.target.value as PlanKey)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {PLAN_KEYS.map((key) => (
              <option key={key} value={key}>
                {PLAN_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" name="name" required defaultValue={PLAN_LABELS[planKey]} key={planKey} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <div className="flex gap-2">
          {CATEGORIES.map((cat) => (
            <label
              key={cat}
              className="flex items-center gap-1.5 rounded-md border border-input px-3 py-1.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input type="radio" name="category" value={cat} required defaultChecked={cat === defaultCategoryFor(planKey)} key={`${planKey}-${cat}`} />
              {PLAN_CATEGORY_LABELS[cat]}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="space-y-2">
          <Label htmlFor="priceDollars">Price ($)</Label>
          <Input id="priceDollars" name="priceDollars" type="number" min={0} step="0.01" placeholder="0" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="billingPeriod">Billing period</Label>
          <select
            id="billingPeriod"
            name="billingPeriod"
            required
            defaultValue="MONTHLY"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {BILLING_PERIODS.map((bp) => (
              <option key={bp} value={bp}>
                {BILLING_PERIOD_LABELS[bp]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="termMonths">Term (months, optional)</Label>
          <Input id="termMonths" name="termMonths" type="number" min={1} placeholder="e.g. 6" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="effectiveDate">Effective date</Label>
          <Input id="effectiveDate" name="effectiveDate" type="date" required defaultValue={todayIso()} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="features">Features (one per line)</Label>
        <Textarea id="features" name="features" rows={3} placeholder={'6 coaching sessions\nUnlimited resume reviews'} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked />
        Active
      </label>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Adding…">Add plan version</SubmitButton>
    </form>
  )
}
