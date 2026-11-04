'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { getSkillClaims, setSkillClaim } from '@/app/skills/claim-actions'
import type { ClaimKind } from '@/lib/skills/claim'
import { cn } from '@/lib/utils'
import { TrackedLink } from '@/components/marketing/TrackedLink'

export interface ClaimableSkill { slug: string; name: string }

// "I have this skill" / "I want to build this", for one skill (a skill page) or a list of them (a job listing). The pages are
// cached for everyone, so what the visitor already said is read after load. A new visitor's first claim goes into onboarding.
export function ClaimSkills({ skills, source, layout = 'rows' }: { skills: ClaimableSkill[]; source: string; layout?: 'rows' | 'buttons' }) {
  const router = useRouter()
  const [claims, setClaims] = useState<Record<string, ClaimKind>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  // The skill the member just claimed, so the next step shows under the control.
  const [last, setLast] = useState<{ slug: string; name: string; kind: ClaimKind } | null>(null)
  const [, start] = useTransition()
  const key = skills.map((s) => s.slug).join(',')

  useEffect(() => {
    let live = true
    getSkillClaims(skills.map((s) => s.slug)).then((c) => live && setClaims(c))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const press = (slug: string, kind: ClaimKind) => {
    const on = claims[slug] !== kind
    setError(null)
    setBusy(`${slug}:${kind}`)
    start(async () => {
      const r = await setSkillClaim(slug, kind, on, source)
      setBusy(null)
      if (!r.ok) return setError(r.error)
      setClaims((c) => { const n = { ...c }; if (r.claim) n[slug] = r.claim; else delete n[slug]; return n })
      setLast(r.claim ? { slug, name: skills.find((x) => x.slug === slug)?.name ?? slug, kind: r.claim } : null)
      if (r.next) router.push(r.next)
    })
  }

  const button = (s: ClaimableSkill, kind: ClaimKind, label: string) => {
    const active = claims[s.slug] === kind
    const working = busy === `${s.slug}:${kind}`
    return (
      <button
        key={kind}
        type="button"
        onClick={() => press(s.slug, kind)}
        disabled={busy !== null}
        aria-pressed={active}
        aria-label={`${label}: ${s.name}`}
        style={busy !== null ? { cursor: 'wait' } : undefined}
        className={cn(
          'rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-wait',
          active ? 'border-success bg-success/5 text-success' : 'border-navy text-navy hover:bg-navy/5',
        )}
      >
        {working ? 'Saving…' : active ? `${label} ✓` : label}
      </button>
    )
  }

  return (
    <div>
      {layout === 'buttons' ? (
        <div className="flex flex-wrap gap-2">{skills.map((s) => [button(s, 'have', 'I have this skill'), button(s, 'build', 'I want to build this')])}</div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-white">
          {skills.map((s) => (
            <li key={s.slug} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <Link href={`/skills/${s.slug}`} className="font-medium text-navy underline-offset-4 hover:underline">{s.name}</Link>
              <span className="flex flex-wrap gap-2">{button(s, 'have', 'I have this')}{button(s, 'build', 'I want to build this')}</span>
            </li>
          ))}
        </ul>
      )}
      {last && claims[last.slug] === last.kind && (
        <p role="status" className="mt-2 text-sm text-ink">
          {last.kind === 'build' ? `${last.name} is on your list of skills to build. ` : `${last.name} is on your profile. `}
          <TrackedLink
            href={last.kind === 'build' ? '/dashboard/learning' : '/dashboard/improve'}
            event="skill_claim_next_clicked"
            properties={{ skillSlug: last.slug, kind: last.kind, source, destination: last.kind === 'build' ? 'learning' : 'improve' }}
            className="font-medium text-brand underline underline-offset-4"
          >
            {last.kind === 'build' ? 'Find a course for it' : 'Improve your search'}
          </TrackedLink>
        </p>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
