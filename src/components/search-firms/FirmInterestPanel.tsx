'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { getFirmInterestState, type FirmInterestState } from '@/app/search-firms/interest-actions'
import { ExpressInterestButton } from '@/components/search-firms/ExpressInterestButton'
import { ShareWithFirmButton } from '@/components/dashboard/ShareWithFirmButton'

const PACKAGE_HREF = '/dashboard/recruiter-package'

function Step({ done, n, title, children }: { done?: boolean; n: number; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${done ? 'border-success bg-success text-white' : 'border-border text-muted-foreground'}`} aria-hidden>
        {done ? <Check className="size-3.5" /> : n}
      </span>
      <span className="text-sm">
        <span className="font-semibold text-foreground">{title}</span>
        {children && <span className="mt-0.5 block text-muted-foreground">{children}</span>}
      </span>
    </li>
  )
}

/**
 * The one ask on a search firm's page. A visitor (or a member who has not picked the firm) reads how it works, then presses
 * one button. A member who already picked the firm sees where they stand with it and goes to their package. The page is cached
 * for everyone, so the visitor's own state is read after load by a server action that only reads.
 */
export function FirmInterestPanel({ orgId, firmName, accent, inboundSlug }: { orgId: string; firmName: string; accent: string | null; inboundSlug: string | null }) {
  const [state, setState] = useState<FirmInterestState | null>(null)
  const load = useCallback(() => { getFirmInterestState(orgId).then(setState).catch(() => setState({ signedIn: false })) }, [orgId])
  useEffect(load, [load])

  const picked = state && state.signedIn && state.picked ? state : null

  if (picked) {
    const sent = picked.status === 'SHARED'
    return (
      <section aria-labelledby="status" className="mt-8 max-w-3xl rounded-2xl border border-border bg-white p-5 sm:p-6">
        <h2 id="status" className="text-xl font-bold tracking-tight text-navy">Your status with {firmName}</h2>
        <ol className="mt-4 space-y-3">
          <Step n={1} done title="You picked this firm.">It is in your recruiter package.</Step>
          <Step n={2} done={picked.hasResume} title={picked.hasResume ? 'Your résumé is on file.' : 'Add your résumé.'}>
            {picked.hasResume ? 'It is what the firm receives when you send it.' : <Link href="/dashboard/resume" className="text-brand underline underline-offset-4">Add it now</Link>}
          </Step>
          <Step n={3} done={sent} title={sent ? `Sent to ${firmName}.` : picked.joined ? `${firmName} has joined. You decide when to send.` : 'Nothing has been sent.'}>
            {sent
              ? 'The firm has your résumé. You can withdraw at any time from your package.'
              : picked.joined
                ? 'It goes only when you press send.'
                : `${firmName} has not joined NextChapter yet. If it joins, we email you before anything is shared.`}
          </Step>
        </ol>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {picked.joined && picked.hasResume && !sent && <ShareWithFirmButton orgId={orgId} firmName={firmName} />}
          <Link href={PACKAGE_HREF} className="inline-flex h-10 items-center rounded-full bg-navy px-6 text-sm font-semibold text-white hover:opacity-90">
            Open my recruiter package
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="interest" className="mt-8 max-w-3xl rounded-2xl border border-border bg-white p-5 sm:p-6">
      <h2 id="interest" className="text-xl font-bold tracking-tight text-navy">Get your résumé in front of {firmName}</h2>
      <ol className="mt-4 space-y-3">
        <Step n={1} title="Add your résumé.">It takes about two minutes. We read it, fill in your profile and you check it. You can create your account at this step.</Step>
        <Step n={2} title="Build your package.">Short steps that make your file stronger: an assessment, résumé fixes, references. Do as many as you like.</Step>
        <Step n={3} title={`You choose when it goes to ${firmName}.`}>
          {inboundSlug ? 'Nothing is sent until you press send.' : `${firmName} has not joined NextChapter yet, so nothing can be sent. If it joins, we email you and you decide.`}
        </Step>
      </ol>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <ExpressInterestButton orgId={orgId} firmName={firmName} source="search_firm_page" primary accent={accent} onDone={load} />
        <span className="text-sm text-muted-foreground">Pressing it saves your interest, then takes you to step 1.</span>
      </div>
      {inboundSlug && (
        <p className="mt-3 text-sm text-muted-foreground">
          Prefer to skip the package? <Link href={`/in/${inboundSlug}`} className="text-brand underline underline-offset-4">Send your résumé to {firmName} directly</Link>.
        </p>
      )}
      {state && state.signedIn && (
        <p className="mt-3 text-sm text-muted-foreground">You are signed in. <Link href={PACKAGE_HREF} className="text-brand underline underline-offset-4">Go to your recruiter package</Link>.</p>
      )}
    </section>
  )
}
