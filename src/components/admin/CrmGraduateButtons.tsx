'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { graduatePerson, graduateOrganization, type GraduationResult } from '@/app/support/admin/(portal)/crm/actions'

/**
 * Conversion into a production record.
 *
 * Deliberately not a plain submit: this creates a row in a system the CRM does
 * not own, so the outcome (including "already linked") is stated rather than
 * left to a page refresh.
 */
export function CrmGraduatePerson({
  personId, coachId, recruiterId,
}: {
  personId: string
  coachId: string | null
  recruiterId: string | null
}) {
  const [result, setResult] = useState<GraduationResult | null>(null)
  const [pending, start] = useTransition()

  if (coachId || recruiterId) {
    return (
      <p className="text-sm text-muted-foreground">
        Converted —{' '}
        <Link href={coachId ? `/support/admin/coaches/${coachId}` : `/support/admin/recruiters/${recruiterId}`} className="underline">
          open their {coachId ? 'coach' : 'recruiter'} record
        </Link>
        . History stays here.
      </p>
    )
  }

  return (
    <div>
      {/* Two discrete targets -> adjacent buttons, per design-principles.md. */}
      <div className="flex flex-wrap gap-2">
        {(['COACH', 'RECRUITER'] as const).map((t) => (
          <button
            key={t}
            type="button"
            disabled={pending}
            onClick={() => start(async () => setResult(await graduatePerson(personId, t)))}
            className={`rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
          >
            {pending ? 'Converting…' : t === 'COACH' ? 'Make them a coach' : 'Make them a recruiter'}
          </button>
        ))}
      </div>
      {result && (
        <p role="status" className={`mt-2 text-sm ${result.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
          {result.message}{' '}
          {result.href && <Link href={result.href} className="font-medium text-brand underline">Open record</Link>}
        </p>
      )}
    </div>
  )
}

export function CrmGraduateOrganization({ orgId, outplacementOrgId }: { orgId: string; outplacementOrgId: string | null }) {
  const [result, setResult] = useState<GraduationResult | null>(null)
  const [pending, start] = useTransition()

  if (outplacementOrgId) {
    return (
      <p className="text-sm text-muted-foreground">
        Converted —{' '}
        <Link href="/support/admin/outplacement-contracts" className="underline">manage their contract</Link>. History stays here.
      </p>
    )
  }

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await graduateOrganization(orgId)))}
        className={`rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
      >
        {pending ? 'Converting…' : 'Make them an outplacement employer'}
      </button>
      {result && (
        <p role="status" className={`mt-2 text-sm ${result.ok ? 'text-muted-foreground' : 'text-destructive'}`}>
          {result.message}{' '}
          {result.href && <Link href={result.href} className="font-medium text-brand underline">Open</Link>}
        </p>
      )}
    </div>
  )
}
