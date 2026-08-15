'use server'

import { revalidatePath } from 'next/cache'
import type { PlanBillingPeriod, PlanCatalogCategory } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { PLAN_KEYS, createPlanCatalogEntry } from '@/lib/admin/plan-catalog'

export type FormState = { error?: string } | undefined

const CATEGORIES: PlanCatalogCategory[] = ['OUTPLACEMENT', 'DIRECT_TO_CONSUMER', 'MEMBERSHIP']
const BILLING_PERIODS: PlanBillingPeriod[] = ['NONE', 'ONE_TIME', 'MONTHLY', 'ANNUAL']

// Creates a new versioned catalog row — never edits or deletes an existing
// one, same rule as the coaching rate card. A price change here only ever
// applies going forward (see getCurrentPlan); anyone already enrolled reads
// their own contract/subscription's own locked-in price once that entity
// exists (a later phase).
export async function createPlanCatalogRow(_prevState: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin()

  const planKey = (formData.get('planKey') as string | null) ?? ''
  if (!PLAN_KEYS.includes(planKey as (typeof PLAN_KEYS)[number])) return { error: 'Choose a plan.' }

  const name = (formData.get('name') as string | null)?.trim() ?? ''
  if (!name) return { error: 'Name is required.' }

  const category = formData.get('category') as string
  if (!CATEGORIES.includes(category as PlanCatalogCategory)) return { error: 'Choose a category.' }

  const billingPeriod = formData.get('billingPeriod') as string
  if (!BILLING_PERIODS.includes(billingPeriod as PlanBillingPeriod)) return { error: 'Choose a billing period.' }

  const priceDollarsRaw = (formData.get('priceDollars') as string | null)?.trim()
  const priceDollars = priceDollarsRaw ? Number(priceDollarsRaw) : 0
  if (priceDollarsRaw && (Number.isNaN(priceDollars) || priceDollars < 0)) return { error: 'Enter a valid price.' }

  const termMonthsRaw = (formData.get('termMonths') as string | null)?.trim()
  const termMonths = termMonthsRaw ? Number(termMonthsRaw) : null
  if (termMonthsRaw && (Number.isNaN(termMonths) || (termMonths ?? 0) <= 0)) {
    return { error: 'Term months must be a positive number.' }
  }

  const effectiveDateRaw = (formData.get('effectiveDate') as string | null)?.trim()
  const effectiveDate = effectiveDateRaw ? new Date(`${effectiveDateRaw}T00:00:00`) : null
  if (!effectiveDate || Number.isNaN(effectiveDate.getTime())) return { error: 'Choose an effective date.' }

  const featuresRaw = (formData.get('features') as string | null) ?? ''
  const features = featuresRaw
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean)

  const active = formData.get('active') === 'on'
  const actor = admin?.email ?? 'admin'
  const priceCents = Math.round(priceDollars * 100)

  await createPlanCatalogEntry({
    planKey,
    name,
    category: category as PlanCatalogCategory,
    priceCents,
    billingPeriod: billingPeriod as PlanBillingPeriod,
    termMonths,
    features,
    effectiveDate,
    active,
    createdBy: actor,
  })

  captureServerEvent(actor, 'plan_catalog_entry_created', { planKey, priceCents, billingPeriod, effectiveDate: effectiveDate.toISOString() })

  revalidatePath('/support/admin/plan-catalog')
}
