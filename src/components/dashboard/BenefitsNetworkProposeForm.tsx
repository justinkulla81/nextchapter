'use client'

import { useActionState } from 'react'
import {
  BENEFITS_NETWORK_FUNCTIONS,
  BENEFITS_NETWORK_LEVELS,
  BENEFITS_NETWORK_FORMATS,
  BENEFITS_NETWORK_COST_TYPES,
  BENEFITS_NETWORK_TIME_COMMITMENTS,
  BENEFITS_NETWORK_CREDENTIAL_TYPES,
  BENEFITS_NETWORK_REDEMPTION_METHODS,
} from '@/lib/constants/benefits-network'
import type { FormState } from '@/app/dashboard/benefits-network/actions'
import { submitListingProposal } from '@/app/dashboard/benefits-network/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

function Select({ label, name, options }: { label: string; name: string; options: readonly string[] }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <select id={name} name={name} required className="w-full rounded-md border border-input px-2 py-2 text-sm">
        <option value="">Choose one</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  )
}

export function BenefitsNetworkProposeForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(submitListingProposal, undefined)

  return (
    <form
      action={formAction}
      className={cn('space-y-6 rounded-lg border border-border p-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="institutionName">Institution name</Label>
          <Input id="institutionName" name="institutionName" required placeholder="e.g. Kellogg School of Management" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="institutionEmail">Your contact&apos;s institutional email</Label>
          <Input
            id="institutionEmail"
            name="institutionEmail"
            type="email"
            required
            placeholder="someone@kellogg.northwestern.edu"
          />
          <p className="text-xs text-muted-foreground">
            We&apos;ll email a confirmation link here — the listing only goes live once it&apos;s clicked. Must be at
            the institution&apos;s own domain, not your personal email.
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="programName">Program name</Label>
        <Input id="programName" name="programName" required placeholder="e.g. Corporate Finance Certificate" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="discountDescription">Discount / terms (short)</Label>
          <Input id="discountDescription" name="discountDescription" required placeholder="e.g. 40% off the certificate" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="seatCount">Seat count (optional)</Label>
          <Input id="seatCount" name="seatCount" type="number" min={1} />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Full description</Label>
        <Textarea id="description" name="description" required rows={3} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="fullCostNote">Total cost, including anything NOT covered</Label>
        <Textarea
          id="fullCostNote"
          name="fullCostNote"
          required
          rows={2}
          placeholder="e.g. Certificate fee waived; materials ($150) and travel are not included."
        />
        <p className="text-xs text-muted-foreground">
          Required by our guardrails (§A4.4) — every listing states the full cost picture, not just the discount.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="redemptionMethod">Redemption method</Label>
          <select id="redemptionMethod" name="redemptionMethod" required className="w-full rounded-md border border-input px-2 py-2 text-sm">
            <option value="">Choose one</option>
            {BENEFITS_NETWORK_REDEMPTION_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="redemptionValue">Code / link</Label>
          <Input id="redemptionValue" name="redemptionValue" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="redemptionInstructions">Redemption instructions</Label>
          <Input id="redemptionInstructions" name="redemptionInstructions" required />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="Function" name="function" options={BENEFITS_NETWORK_FUNCTIONS} />
        <Select label="Level" name="level" options={BENEFITS_NETWORK_LEVELS} />
        <Select label="Format" name="format" options={BENEFITS_NETWORK_FORMATS} />
        <Select label="Cost type" name="costType" options={BENEFITS_NETWORK_COST_TYPES} />
        <Select label="Time commitment" name="timeCommitment" options={BENEFITS_NETWORK_TIME_COMMITMENTS} />
        <Select label="Credential type" name="credentialType" options={BENEFITS_NETWORK_CREDENTIAL_TYPES} />
      </div>

      <div className="space-y-1">
        <Label htmlFor="skillGapTags">Skill tags (comma-separated, up to 8)</Label>
        <Input id="skillGapTags" name="skillGapTags" placeholder="e.g. Financial modeling, FP&A, Corporate finance" />
        <p className="text-xs text-muted-foreground">
          Used to surface this offer to candidates whose Dossier names a matching skill gap.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="expiresAt">Expires on</Label>
          <Input id="expiresAt" name="expiresAt" type="date" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reviewDate">Review date (when we should re-check this)</Label>
          <Input id="reviewDate" name="reviewDate" type="date" required />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-success">{state.success}</p>}
      <SubmitButton pendingLabel="Submitting…">Submit proposal</SubmitButton>
    </form>
  )
}
