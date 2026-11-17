'use client'

import { useActionState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { LABELS, LIMITS, type PublicPageContentData, type PublicPageKind } from '@/lib/public-page/content'

export type PublicPageFormState = { ok?: boolean; message?: string; error?: string; values?: Record<string, string> } | undefined

const STATUS_LINE: Record<string, string> = {
  PENDING: 'Waiting for NextChapter to review your first version. It shows on your page once approved.',
  PUBLISHED: 'Live on your page.',
  DECLINED: 'NextChapter asked for a change before this goes live:',
  DRAFT: 'Not on your page yet.',
}

// The organization's own section on its public page. The form keeps everything typed when something fails.
export function PublicPageEditor({
  kind,
  draft,
  status,
  reviewNote,
  firstApproved,
  pageUrls,
  picturesHref,
  action,
}: {
  kind: PublicPageKind
  draft: PublicPageContentData | null
  status: string | null
  reviewNote: string | null
  firstApproved: boolean
  pageUrls: string[]
  picturesHref: string | null
  action: (prev: PublicPageFormState, fd: FormData) => Promise<PublicPageFormState>
}) {
  const [state, formAction] = useActionState(action, undefined)
  const L = LABELS[kind]
  const d = draft
  // After a failed save the form shows what was typed (React resets a form to its defaults after the action runs).
  const v = (name: string, fallback: string) => state?.values?.[name] ?? fallback
  const events = [...(d?.events ?? []), ...Array.from({ length: LIMITS.events }, () => null)].slice(0, LIMITS.events)
  return (
    <form action={formAction} className="max-w-3xl space-y-6">
      <div className="space-y-1">
        {status && (
          <p className="text-sm font-medium">
            {STATUS_LINE[status] ?? ''} {status === 'DECLINED' && reviewNote ? <span className="font-normal">{reviewNote}</span> : null}
          </p>
        )}
        <p className="text-sm text-muted-foreground">
          {firstApproved ? 'Saving publishes your changes right away.' : 'Your first version is checked by NextChapter before it shows; after that, saving publishes right away.'}{' '}
          Figures from public sources on your page (job counts, layoff filings, federal data) are not editable.
        </p>
        {pageUrls.length > 0 && (
          <p className="text-sm">
            Your page:{' '}
            {pageUrls.map((u, i) => (
              <span key={u}>
                {i > 0 && ', '}
                <a href={u} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                  {u.replace(/^https?:\/\//, '')}
                </a>
              </span>
            ))}
          </p>
        )}
        {picturesHref && (
          <p className="text-sm text-muted-foreground">
            Your picture, logo and tagline come from your <a href={picturesHref} className="font-medium text-primary hover:underline">branding</a>, and are copied to the page each time you save.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pp-intro">Introduction</Label>
        <Textarea id="pp-intro" name="intro" maxLength={LIMITS.intro} rows={5} defaultValue={v('intro', d?.intro ?? '')} placeholder="Who you are and who you help, in a few sentences." />
        <p className="text-xs text-muted-foreground">Up to {LIMITS.intro} characters.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pp-highlights">{L.highlights}</Label>
        <Textarea id="pp-highlights" name="highlights" rows={5} defaultValue={v('highlights', (d?.highlights ?? []).join('\n'))} />
        <p className="text-xs text-muted-foreground">{L.highlightsHelp} Up to {LIMITS.highlights}.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{L.events}</legend>
        <p className="text-xs text-muted-foreground">Past dates drop off the page by themselves.</p>
        {events.map((e, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr]">
            <Input aria-label={`Event ${i + 1} name`} name={`event-title-${i}`} defaultValue={v(`event-title-${i}`, e?.title ?? '')} placeholder="Name" maxLength={LIMITS.eventTitle} />
            <Input aria-label={`Event ${i + 1} date`} name={`event-date-${i}`} type="date" defaultValue={v(`event-date-${i}`, e?.date ?? '')} />
            <Input aria-label={`Event ${i + 1} link`} name={`event-url-${i}`} defaultValue={v(`event-url-${i}`, e?.url ?? '')} placeholder="Link (optional)" />
          </div>
        ))}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-medium">Contact</legend>
        <div className="space-y-1.5">
          <Label htmlFor="pp-website">{L.website}</Label>
          <Input id="pp-website" name="website" defaultValue={v('website', d?.contact.website ?? '')} placeholder="https://" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pp-email">Email</Label>
          <Input id="pp-email" name="email" type="email" defaultValue={v('email', d?.contact.email ?? '')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pp-phone">Phone</Label>
          <Input id="pp-phone" name="phone" defaultValue={v('phone', d?.contact.phone ?? '')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pp-hours">Hours</Label>
          <Input id="pp-hours" name="hours" maxLength={LIMITS.hours} defaultValue={v('hours', d?.contact.hours ?? '')} placeholder="Mon–Fri, 8:30–4:30" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pp-address">Address</Label>
          <Input id="pp-address" name="address" maxLength={LIMITS.address} defaultValue={v('address', d?.contact.address ?? '')} />
        </div>
      </fieldset>

      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p role="status" className="text-sm text-success">{state.message}</p>}
      <SubmitButton pendingLabel="Saving…">{firstApproved ? 'Save and publish' : 'Save and send for review'}</SubmitButton>
    </form>
  )
}
