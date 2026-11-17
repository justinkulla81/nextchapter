'use client'

import { useActionState, useEffect, useSyncExternalStore } from 'react'
import { posthog } from '@/lib/posthog/client'
import { requestClaimAction, type OrgClaimState } from '@/app/prepared/[slug]/org-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SubmitButton } from '@/components/ui/submit-button'
import { EMPLOYER_SECTIONS } from '@/lib/employer/sections'

const noSubscribe = () => () => {}
function readVia(): string | null {
  const t = new URLSearchParams(window.location.search).get('via')
  return t && /^[A-Za-z0-9_-]{24,64}$/.test(t) ? t : null
}

export function OrgClaimForm({ slug, orgName, domain, sections = false }: { slug: string; orgName: string; domain: string | null; sections?: boolean }) {
  // A related organization's invite arrives as ?via=<token>. Read in the browser so the claim page stays cached; the server
  // checks the token belongs to this organization before keeping it (related-orgs.ts).
  const via = useSyncExternalStore(noSubscribe, readVia, () => null)
  useEffect(() => {
    if (via) posthog.capture('related_org_invite_opened', { slug })
  }, [via, slug])
  const [state, action] = useActionState<OrgClaimState, FormData>(requestClaimAction.bind(null, slug), undefined)
  if (state?.sent) {
    return (
      <div role="status" className="rounded-xl border border-border bg-white p-5">
        <p className="font-semibold text-navy">Check your email.</p>
        <p className="mt-1 text-sm text-muted-foreground">We sent a confirmation link to {state.sent.email}. It works once and expires in 7 days. Nothing is claimed until you use it.</p>
      </div>
    )
  }
  const v = state?.values
  return (
    <form action={action} className="space-y-4">
      {via && (
        <>
          <input type="hidden" name="via" value={via} />
          <p className="text-sm font-medium text-navy">An organization you work with linked {orgName} on NextChapter. Claim the page and the two of you are connected.</p>
        </>
      )}
      {sections && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What do you want to claim?</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {EMPLOYER_SECTIONS.map((s) => (
              <label key={s.key} className="flex cursor-pointer flex-col gap-0.5 rounded-lg border border-border bg-white p-3 text-sm has-[:checked]:border-navy has-[:checked]:ring-1 has-[:checked]:ring-navy has-[:focus-visible]:ring-2">
                <span className="flex items-center gap-2 font-medium">
                  <input type="radio" name="section" value={s.key} defaultChecked={(v?.section ?? 'hiring') === s.key} />
                  {s.label}
                </span>
                <span className="text-xs text-muted-foreground">{s.employees}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="claim-name">Your name</Label><Input id="claim-name" name="name" autoComplete="name" defaultValue={v?.name} required /></div>
        <div className="space-y-1.5"><Label htmlFor="claim-title">Your title</Label><Input id="claim-title" name="title" autoComplete="organization-title" defaultValue={v?.title} required /></div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="claim-email">Work email</Label>
        <Input id="claim-email" name="email" type="email" autoComplete="email" defaultValue={v?.email} aria-describedby="claim-email-why" required />
        <p id="claim-email-why" className="text-xs text-muted-foreground">
          {domain ? `Why we ask: only an address at ${domain} can claim the ${orgName} page.` : `Why we ask: we confirm you can read mail at your organization. A personal address cannot claim the ${orgName} page.`}
        </p>
      </div>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <SubmitButton pendingLabel="Sending your link">{sections ? 'Claim this section' : 'Claim this page'}</SubmitButton>
    </form>
  )
}
