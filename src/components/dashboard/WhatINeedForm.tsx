'use client'

import { useActionState, useState } from 'react'
import { updateWhatINeed } from '@/app/dashboard/what-i-need/actions'
import { SubmitButton } from '@/components/ui/submit-button'
import { Label } from '@/components/ui/label'
import { ChoiceButtons } from '@/components/onboarding/ChoiceButtons'
import { cn } from '@/lib/utils'
import {
  WORK_VALUE_DOMAIN_ORDER,
  WORK_VALUE_DOMAIN_LABELS,
  WHAT_I_NEED_ITEMS,
  IMPORTANCE_RATING_LABELS,
  type WorkValueDomain,
  type ImportanceRating,
} from '@/lib/constants/what-i-need'

const RATING_OPTIONS = ([1, 2, 3, 4] as ImportanceRating[]).map((rating) => ({
  value: String(rating),
  label: IMPORTANCE_RATING_LABELS[rating],
}))

export function WhatINeedForm({
  initialRatings,
  initialDomainRank,
}: {
  initialRatings: Record<string, ImportanceRating>
  initialDomainRank: WorkValueDomain[]
}) {
  const [state, formAction, pending] = useActionState(updateWhatINeed, undefined)
  const [ratings, setRatings] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(WHAT_I_NEED_ITEMS.map((item) => [item.id, initialRatings[item.id] ? String(initialRatings[item.id]) : null]))
  )
  const [domainRank, setDomainRank] = useState<WorkValueDomain[]>(
    initialDomainRank.length === 6 ? initialDomainRank : []
  )

  function toggleDomainRank(domain: WorkValueDomain) {
    setDomainRank((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : prev.length >= 6 ? prev : [...prev, domain]
    )
  }

  return (
    <form
      action={formAction}
      className={cn('space-y-8', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="space-y-2">
        <Label>
          Rank these six from most to least important to you — click in order, most important first
        </Label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {WORK_VALUE_DOMAIN_ORDER.map((domain) => {
            const rank = domainRank.indexOf(domain)
            const isSelected = rank !== -1
            const isDisabled = !isSelected && domainRank.length >= 6
            return (
              <button
                key={domain}
                type="button"
                disabled={isDisabled}
                onClick={() => toggleDomainRank(domain)}
                aria-pressed={isSelected}
                className={cn(
                  'rounded-lg border-2 p-3 text-left text-sm font-medium transition-colors',
                  isSelected
                    ? 'border-brand bg-brand/5 text-brand'
                    : isDisabled
                      ? 'cursor-not-allowed border-border bg-off-white text-muted-foreground/50'
                      : 'border-border bg-white text-foreground hover:border-brand/40'
                )}
              >
                {isSelected && <span className="mr-2 tabular-nums">{rank + 1}.</span>}
                {WORK_VALUE_DOMAIN_LABELS[domain]}
              </button>
            )
          })}
        </div>
        {domainRank.map((d) => (
          <input key={d} type="hidden" name="domainRank" value={d} />
        ))}
      </div>

      {WORK_VALUE_DOMAIN_ORDER.map((domain) => (
        <div key={domain} className="space-y-4">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {WORK_VALUE_DOMAIN_LABELS[domain]}
          </h3>
          {WHAT_I_NEED_ITEMS.filter((item) => item.domain === domain).map((item) => (
            <div key={item.id} className="space-y-2">
              <Label>{item.text}</Label>
              <ChoiceButtons
                name={`rating__${item.id}`}
                options={RATING_OPTIONS}
                value={ratings[item.id]}
                onChange={(value) => setRatings((prev) => ({ ...prev, [item.id]: value }))}
                columns={4}
                responsive
              />
            </div>
          ))}
        </div>
      ))}

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton pendingLabel="Saving…">Save What I Need</SubmitButton>
    </form>
  )
}
