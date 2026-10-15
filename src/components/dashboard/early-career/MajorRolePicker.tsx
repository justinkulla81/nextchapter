'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { posthog } from '@/lib/posthog/client'
import { setTargetRoleFromMajor } from '@/app/dashboard/early-career/actions'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MAJORS } from '@/lib/early-career/major-roles'
import type { RoleWithSkills } from '@/lib/early-career/data'
import { cn } from '@/lib/utils'

// Major → entry-level roles. Picking a major reloads the page with ?major=,
// so the O*NET skills come from the server; "Make this my target role" saves
// the title the job board matches against.
export function MajorRolePicker({
  majorKey,
  roles,
  targetRoleType,
}: {
  majorKey: string | null
  roles: RoleWithSkills[]
  targetRoleType: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function pickMajor(key: string) {
    const major = MAJORS.find((m) => m.key === key)
    posthog.capture('major_role_picker_used', { major: key, roles: major?.roles.map((r) => r.title) ?? [] })
    startTransition(() => router.push(`/dashboard/early-career?major=${encodeURIComponent(key)}#roles`, { scroll: false }))
  }

  function makeTarget(role: string) {
    if (!majorKey) return
    setError(null)
    setSaving(role)
    startTransition(async () => {
      const res = await setTargetRoleFromMajor(majorKey, role)
      setSaving(null)
      if (res.error) setError(res.error)
      else router.refresh()
    })
  }

  return (
    <div className={cn('space-y-4', pending && 'cursor-progress [&_*]:cursor-progress')}>
      <div className="max-w-sm space-y-2">
        <Label htmlFor="ec-major-picker">Your major</Label>
        <Select items={MAJORS.map((m) => ({ value: m.key, label: m.label }))} value={majorKey ?? null} onValueChange={(v) => v && pickMajor(String(v))}>
          <SelectTrigger id="ec-major-picker" className="w-full">
            <SelectValue placeholder="Pick your major" />
          </SelectTrigger>
          <SelectContent>
            {MAJORS.map((m) => (
              <SelectItem key={m.key} value={m.key}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!majorKey && <p className="text-sm text-muted-foreground">Pick your major to see the entry-level roles it leads to most often.</p>}

      {majorKey && roles.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {roles.map((r) => {
            const isTarget = targetRoleType?.trim().toLowerCase() === r.title.toLowerCase()
            return (
              <li key={r.title} className="space-y-2 rounded-lg border border-border bg-white p-4">
                <p className="font-medium">{r.title}</p>
                {r.skills.length > 0 && <p className="text-sm text-muted-foreground">Skills it asks for: {r.skills.join(', ')}.</p>}
                {r.tools.length > 0 && <p className="text-sm text-muted-foreground">Tools in demand: {r.tools.join(', ')}.</p>}
                {r.skills.length === 0 && r.tools.length === 0 && <p className="text-sm text-muted-foreground">Skill data for this role is not in yet.</p>}
                {isTarget ? (
                  <p className="text-sm font-medium text-success">Your target role</p>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => makeTarget(r.title)} disabled={saving !== null}>
                    {saving === r.title ? 'Saving…' : 'Make this my target role'}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {majorKey && (
        <Link href="/dashboard/find-my-job?seniority=ENTRY_LEVEL" className="inline-block text-sm font-medium text-brand underline underline-offset-4">
          See entry-level jobs
        </Link>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
