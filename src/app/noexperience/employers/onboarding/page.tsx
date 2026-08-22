import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { completeCrucibleEmployerOnboarding } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const metadata: Metadata = {
  title: { absolute: 'noexperienceneeded.ai — Tell us about your company' },
  robots: { index: false, follow: false },
}

// Self-description bucket, deliberately separate from COMPANY_SIZE_OPTIONS
// (that set includes an "Any" wildcard for candidate-side filtering — not a
// fit for an employer describing their own company).
const COMPANY_SIZE_OPTIONS = ['1-10', '11-50', '51-200', '201-1000', '1000+'] as const

const FUNCTION_INTEREST_OPTIONS = [
  { value: 'TECH', label: 'Tech / Engineering' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'DATA', label: 'Data / Analytics' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'BUSINESS', label: 'Business / Operations' },
  { value: 'GENERALIST', label: 'Generalist — open to any function' },
] as const

export default async function CrucibleEmployerOnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/noexperience/employers/login')

  const profile = await prisma.crucibleEmployerProfile.findUnique({ where: { userId: user.id } })
  if (!profile) redirect('/noexperience/employers/signup')
  if (profile.onboardingCompletedAt) redirect('/noexperience/employers/candidates')

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-sm font-medium text-muted-foreground">noexperienceneeded.ai for Employers</p>
        <h1 className="text-2xl font-semibold tracking-tight">Tell us about your company</h1>
        <p className="text-muted-foreground">
          One quick step, then you&apos;ll see every candidate who passed and chose to share their resume.
        </p>
      </div>

      <form action={completeCrucibleEmployerOnboarding} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="companyWebsite">Company website (optional)</Label>
          <Input id="companyWebsite" name="companyWebsite" placeholder="acme.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="companySize">Company size</Label>
          <Select name="companySize" defaultValue={COMPANY_SIZE_OPTIONS[0]}>
            <SelectTrigger id="companySize" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) => (value ? `${value} employees` : 'Select one')}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {COMPANY_SIZE_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt} employees
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="functionInterest">What are you hiring for?</Label>
          <Select name="functionInterest" defaultValue="GENERALIST" required>
            <SelectTrigger id="functionInterest" className="w-full">
              <SelectValue placeholder="Select one">
                {(value: string | null) =>
                  FUNCTION_INTEREST_OPTIONS.find((o) => o.value === value)?.label ?? 'Select one'
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FUNCTION_INTEREST_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" className="w-full">
          Continue to candidates
        </Button>
      </form>
    </div>
  )
}
