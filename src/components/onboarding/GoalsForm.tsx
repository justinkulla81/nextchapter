'use client'

import { useActionState, useState } from 'react'
import { updateGoals } from '@/app/onboarding/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TagInput } from './TagInput'
import { TradeoffRanking } from './TradeoffRanking'
import { COMPANY_SIZE_OPTIONS, COMPANY_STAGE_OPTIONS } from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'
import type { CandidateProfile } from '@prisma/client'

export function GoalsForm({
  profile,
  inferredIndustries,
}: {
  profile: CandidateProfile
  inferredIndustries: string[]
}) {
  const [state, formAction, pending] = useActionState(updateGoals, undefined)
  const [willingToStartLower, setWillingToStartLower] = useState(profile.willingToStartLower)

  return (
    <form
      action={formAction}
      className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      {profile.resumeLatestJobTitle && (
        <p className="text-sm text-muted-foreground">
          Your last title was <span className="font-medium text-foreground">{profile.resumeLatestJobTitle}</span>.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="targetRoleType">
          What role are you targeting? <span className="font-normal text-muted-foreground">(it&apos;s OK to say &quot;flexible&quot;)</span>
        </Label>
        <Input
          id="targetRoleType"
          name="targetRoleType"
          defaultValue={profile.targetRoleType ?? ''}
        />
      </div>

      <div className="space-y-2">
        {inferredIndustries.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Your past industries included:{' '}
            <span className="font-medium text-foreground">{inferredIndustries.join(', ')}</span>.
            We&apos;ve added these below — remove any that don&apos;t apply, or add more.
          </p>
        )}
        <Label>Target industries</Label>
        <TagInput
          name="targetIndustries"
          defaultValue={profile.targetIndustries.length > 0 ? profile.targetIndustries : inferredIndustries}
          placeholder="e.g. Healthcare, Fintech"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="targetCompanySize">Target company size</Label>
          <Select name="targetCompanySize" defaultValue={profile.targetCompanySize ?? undefined}>
            <SelectTrigger id="targetCompanySize" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) =>
                  value ? (value === 'Any' ? 'Any size' : `${value} employees`) : 'Select one'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size}>
                  {size === 'Any' ? 'Any size' : `${size} employees`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="targetCompanyStage">Target company type</Label>
          <Select name="targetCompanyStage" defaultValue={profile.targetCompanyStage ?? undefined}>
            <SelectTrigger id="targetCompanyStage" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) =>
                  COMPANY_STAGE_OPTIONS.find((opt) => opt.value === value)?.label ?? 'Select one'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMPANY_STAGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetCompMin">What is the minimum comp you are able to take? (optional)</Label>
        <div className="flex items-center gap-2">
          <div className="relative w-36">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              $
            </span>
            <Input
              id="targetCompMin"
              name="targetCompMinThousands"
              type="number"
              min={0}
              placeholder="120"
              className="pl-7"
              defaultValue={profile.targetCompMin ? Math.round(profile.targetCompMin / 1000) : undefined}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            ,000 — e.g. enter <span className="font-medium text-foreground">120</span> for $120,000
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="compFlexible"
            name="compFlexible"
            value="on"
            defaultChecked={profile.compFlexible}
          />
          <Label htmlFor="compFlexible" className="font-normal">
            I have flexibility on compensation
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="equityImportant"
            name="equityImportant"
            value="on"
            defaultChecked={profile.equityImportant}
          />
          <Label htmlFor="equityImportant" className="font-normal">
            Equity matters to me
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="willingToStartLower"
            name="willingToStartLower"
            value="on"
            defaultChecked={profile.willingToStartLower}
            onCheckedChange={setWillingToStartLower}
          />
          <Label htmlFor="willingToStartLower" className="font-normal">
            I&apos;m willing to start at a lower level or title
          </Label>
        </div>
        {willingToStartLower && (
          <Textarea
            name="startLowerRationale"
            placeholder="Why? (optional, but helps employers understand the offer)"
            rows={2}
            defaultValue={profile.startLowerRationale ?? ''}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>
          Rank what matters most to you right now — drag isn&apos;t required, use the arrows.
        </Label>
        <p className="text-sm text-muted-foreground">1 = matters most, 5 = matters least.</p>
        <TradeoffRanking profile={profile} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="dealBreakers">Any deal-breakers? (optional)</Label>
        <Textarea
          id="dealBreakers"
          name="dealBreakers"
          rows={2}
          defaultValue={profile.dealBreakers ?? ''}
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Calculating your score…' : 'See my Employability Score'}
      </Button>
    </form>
  )
}
