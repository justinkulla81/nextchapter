'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { submitEmployerWaitlist, type SubmitEmployerWaitlistState } from '@/app/employers/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SubmitButton } from '@/components/ui/submit-button'
import { cn } from '@/lib/utils'

const PROVIDERS = ['None', 'LHH', 'Randstad RiseSmart', 'Careerminds', 'INTOO', 'Other']
const COMPANY_SIZES = ['1–200', '201–1,000', '1,001–5,000', '5,000+']

const INITIAL_STATE: SubmitEmployerWaitlistState = { status: 'idle' }

// Partners Master Build Script §C3.3/§C4.3 — the employer form is "a
// walkthrough-booking flow, not a contact form," and the confirmation
// "should give something: a sample compliance pack and a one-page cost
// comparison. Not 'we'll be in touch.'"
export function EmployerWaitlistForm() {
  const [state, formAction, pending] = useActionState(submitEmployerWaitlist, INITIAL_STATE)

  if (state.status === 'success') {
    return (
      <div className="space-y-3 rounded-lg border border-success/30 bg-success/5 p-5 text-sm text-foreground">
        <p className="font-semibold text-navy">Request received — here&apos;s what to look at right now.</p>
        <p>We&apos;ll reach out to schedule your walkthrough. In the meantime:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <Link href="/employers#compliance-pack" className="text-primary underline underline-offset-4">
              See a sample compliance pack →
            </Link>
          </li>
          <li>
            <Link href="/pricing" className="text-primary underline underline-offset-4">
              Compare our list prices to a typical incumbent quote →
            </Link>
          </li>
        </ul>
      </div>
    )
  }

  return (
    <form
      action={formAction}
      className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ew-fullName">Full name</Label>
          <Input id="ew-fullName" name="fullName" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ew-workEmail">Work email</Label>
          <Input id="ew-workEmail" name="workEmail" type="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ew-role">Your role</Label>
          <Input id="ew-role" name="role" placeholder="e.g. VP People, CHRO" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ew-company">Company</Label>
          <Input id="ew-company" name="company" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ew-companySize">Company size</Label>
          <Select name="companySize">
            <SelectTrigger id="ew-companySize" className="w-full">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ew-currentProvider">Current outplacement provider</Label>
          <Select name="currentProvider">
            <SelectTrigger id="ew-currentProvider" className="w-full">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ew-evaluatingWindow">Are you evaluating outplacement now, in the next 6 months, or exploring?</Label>
        <Select name="evaluatingWindow" defaultValue="exploring">
          <SelectTrigger id="ew-evaluatingWindow" className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="now">Evaluating now</SelectItem>
            <SelectItem value="next_6_months">In the next 6 months</SelectItem>
            <SelectItem value="exploring">Just exploring</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ew-anticipatedVolume">Anticipated volume</Label>
        <Select name="anticipatedVolume" defaultValue="under_10">
          <SelectTrigger id="ew-anticipatedVolume" className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="under_10">Under 10</SelectItem>
            <SelectItem value="10_50">10–50</SelectItem>
            <SelectItem value="50_200">50–200</SelectItem>
            <SelectItem value="200_plus">200+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ew-levelsAffected">Levels affected</Label>
        <Select name="levelsAffected">
          <SelectTrigger id="ew-levelsAffected" className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="IC">IC</SelectItem>
            <SelectItem value="Manager">Manager</SelectItem>
            <SelectItem value="Director">Director</SelectItem>
            <SelectItem value="VP+">VP+</SelectItem>
            <SelectItem value="Mixed">Mixed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ew-whatMattersMost">What matters most</Label>
        <Select name="whatMattersMost">
          <SelectTrigger id="ew-whatMattersMost" className="w-full">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Cost">Cost</SelectItem>
            <SelectItem value="Outcomes">Outcomes</SelectItem>
            <SelectItem value="Reporting">Reporting</SelectItem>
            <SelectItem value="Employee experience">Employee experience</SelectItem>
            <SelectItem value="Speed">Speed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ew-timeline">Timeline (optional)</Label>
        <Textarea id="ew-timeline" name="timeline" rows={2} placeholder="Any dates or constraints we should know" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ew-referredBy">Who referred you? (optional)</Label>
        <Input id="ew-referredBy" name="referredBy" placeholder="Name or company" />
      </div>

      {/* Honeypot */}
      <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
        <label htmlFor="ew-gotcha">Leave this field empty</label>
        <input id="ew-gotcha" name="_gotcha" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === 'error' && <p className="text-sm text-destructive">{state.error}</p>}

      <SubmitButton className="w-full" pendingLabel="Submitting…">
        Book a walkthrough
      </SubmitButton>
    </form>
  )
}
