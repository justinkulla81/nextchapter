'use client'

import { useActionState, useState, useTransition } from 'react'
import { usePostHog } from 'posthog-js/react'
import { createRole, extractRoleFromJDAction } from '@/app/talent/(app)/roles/new/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PRIMARY_FUNCTION_OPTIONS, HIGHEST_LEVEL_OPTIONS } from '@/lib/constants/onboarding'
import { cn } from '@/lib/utils'

const REMOTE_POLICY_OPTIONS = [
  { value: 'onsite', label: 'On-site' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
]

export function RoleForm() {
  const [state, formAction, pending] = useActionState(createRole, undefined)
  const posthog = usePostHog()

  const [jdText, setJdText] = useState('')
  const [extracting, startExtracting] = useTransition()
  const [aiDrafted, setAiDrafted] = useState(false)

  const [roleTitle, setRoleTitle] = useState('')
  const [primaryFunction, setPrimaryFunction] = useState('')
  const [roleLevel, setRoleLevel] = useState('')
  const [locationRequirement, setLocationRequirement] = useState('')
  const [remotePolicy, setRemotePolicy] = useState('')
  const [compMin, setCompMin] = useState('')
  const [compMax, setCompMax] = useState('')

  function handleExtract() {
    posthog?.capture('role_jd_extract_clicked')
    startExtracting(async () => {
      const fields = await extractRoleFromJDAction(jdText)
      if (!fields) return
      if (fields.roleTitle) setRoleTitle(fields.roleTitle)
      if (fields.primaryFunction) setPrimaryFunction(fields.primaryFunction)
      if (fields.roleLevel) setRoleLevel(fields.roleLevel)
      if (fields.locationRequirement) setLocationRequirement(fields.locationRequirement)
      if (fields.remotePolicy) setRemotePolicy(fields.remotePolicy)
      if (fields.compMin) setCompMin(String(fields.compMin))
      if (fields.compMax) setCompMax(String(fields.compMax))
      setAiDrafted(true)
    })
  }

  return (
    <form action={formAction} className={cn('space-y-6', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="space-y-2 rounded-lg border border-dashed border-border p-4">
        <Label htmlFor="jdPaste">Have an existing job description? Paste it here and we&apos;ll fill in the rest.</Label>
        <Textarea
          id="jdPaste"
          rows={6}
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the full job posting text..."
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!jdText.trim() || extracting}
          onClick={handleExtract}
          className={cn(extracting && 'cursor-progress')}
        >
          {extracting ? 'Reading the posting…' : 'Extract details'}
        </Button>
        {aiDrafted && (
          <p className="text-xs text-muted-foreground">
            AI-drafted from your paste — review and edit before posting. Anything not clearly stated
            was left blank rather than guessed.
          </p>
        )}
      </div>

      <input type="hidden" name="viaJdExtraction" value={aiDrafted ? 'on' : ''} />

      <div className="space-y-2">
        <Label htmlFor="roleTitle">Role title</Label>
        <Input
          id="roleTitle"
          name="roleTitle"
          required
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="primaryFunction">Function</Label>
          <Select name="primaryFunction" value={primaryFunction} onValueChange={(value) => setPrimaryFunction(value ?? '')}>
            <SelectTrigger id="primaryFunction" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) => value || 'Select one'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PRIMARY_FUNCTION_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="roleLevel">Level</Label>
          <Select name="roleLevel" value={roleLevel} onValueChange={(value) => setRoleLevel(value ?? '')}>
            <SelectTrigger id="roleLevel" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) => value || 'Select one'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {HIGHEST_LEVEL_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="locationRequirement">Location</Label>
        <Input
          id="locationRequirement"
          name="locationRequirement"
          value={locationRequirement}
          onChange={(e) => setLocationRequirement(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Remote policy</Label>
        <div className="flex gap-2">
          {REMOTE_POLICY_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={remotePolicy === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRemotePolicy(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <input type="hidden" name="remotePolicy" value={remotePolicy} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="compMin">Comp min ($)</Label>
          <Input
            id="compMin"
            name="compMin"
            type="number"
            value={compMin}
            onChange={(e) => setCompMin(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="compMax">Comp max ($)</Label>
          <Input
            id="compMax"
            name="compMax"
            type="number"
            value={compMax}
            onChange={(e) => setCompMax(e.target.value)}
          />
        </div>
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className={pending ? 'cursor-progress' : ''}>
        {pending ? 'Posting…' : 'Post this role'}
      </Button>
    </form>
  )
}
