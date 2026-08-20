'use client'

import { useState } from 'react'
import type { SupportNetworkContact } from '@prisma/client'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SubmitButton } from '@/components/ui/submit-button'
import { RelationshipTagsFieldset } from '@/components/dashboard/RelationshipTagsFieldset'
import { TagInput } from '@/components/onboarding/TagInput'
import { updateContact } from '@/app/dashboard/network/actions'
import type { NextChapterMembership } from '@/lib/network/next-chapter-membership'
import { cn } from '@/lib/utils'

export const OUTREACH_CHANNEL_LABEL: Record<string, string> = {
  EMAIL: 'email',
  LINKEDIN: 'LinkedIn message',
  PHONE: 'phone call',
  TEXT: 'text',
  MEETING: 'meeting',
}

// Shared row shape between the Contact Directory table (a page of these)
// and the single-contact profile page (exactly one) — both derive it the
// same way from a SupportNetworkContact plus its outreach history and
// NextChapter-membership lookup.
export interface ContactRowData extends SupportNetworkContact {
  hasReachedOut: boolean
  lastOutreachChannel: string | null
  lastOutreachAt: Date | null
  outreachCount: number
  membership: NextChapterMembership | null
  // §4.4: "Flag contacts who currently work at their employer before
  // sending." Computed server-side (src/lib/network/current-employer-flag.ts)
  // against the candidate's own WorkHistoryEntry — only ever true when the
  // candidate is in Confidential Search Mode.
  isAtCurrentEmployer: boolean
}

// The editable detail form for one contact — used both inline (Contact
// Directory table row expansion) and as the main content of the dedicated
// contact profile page (/dashboard/network/contacts/[id]), so editing a
// contact works identically from either entry point.
export function ContactDetailPanel({ contact }: { contact: ContactRowData }) {
  const referenceHref = `/dashboard/references?name=${encodeURIComponent(contact.name)}&email=${encodeURIComponent(
    contact.email ?? ''
  )}`
  const [dirty, setDirty] = useState(false)

  return (
    <div className="space-y-4">
      <div className="space-y-1 rounded-lg border border-border bg-background p-3">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Communications</p>
        {contact.outreachCount > 0 ? (
          <p className="text-sm text-foreground">
            You&apos;ve reached out {contact.outreachCount} time{contact.outreachCount === 1 ? '' : 's'}
            {contact.lastOutreachAt && contact.lastOutreachChannel && (
              <>
                {' '}
                — most recently by {OUTREACH_CHANNEL_LABEL[contact.lastOutreachChannel] ?? contact.lastOutreachChannel.toLowerCase()}{' '}
                on {contact.lastOutreachAt.toLocaleDateString()}
              </>
            )}
            .
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No outreach logged with {contact.name} yet.</p>
        )}
      </div>

      <form
        action={updateContact.bind(null, contact.id)}
        className="space-y-3"
        onChange={() => setDirty(true)}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <LabeledInput name="name" label="Name" defaultValue={contact.name} required className="max-w-[220px]" />
          <LabeledInput name="company" label="Company" defaultValue={contact.company ?? ''} className="max-w-[220px]" />
          <LabeledInput name="title" label="Title" defaultValue={contact.title ?? ''} />
          <LabeledInput name="phone" label="Phone" type="tel" defaultValue={contact.phone ?? ''} />
          <LabeledInput name="linkedinUrl" label="LinkedIn URL" type="url" defaultValue={contact.linkedinUrl ?? ''} />
        </div>

        <div className="max-w-[320px] space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Emails (up to 3, first is primary)</label>
          <TagInput
            name="emails"
            defaultValue={contact.emails.length > 0 ? contact.emails : contact.email ? [contact.email] : []}
            placeholder="Add an email and press Enter"
            maxTags={3}
            inputType="email"
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <RelationshipTagsFieldset
            defaultTags={contact.relationshipTags}
            inferredCompany={contact.inferredCompany}
            inferredSchool={contact.inferredSchool}
          />
        </div>

        <LabeledInput
          name="customTags"
          label="Custom tags (comma-separated)"
          defaultValue={contact.customTags.join(', ')}
          className="max-w-none"
        />

        <div className="space-y-1">
          <label htmlFor="notes" className="text-xs font-medium text-muted-foreground">
            Notes
          </label>
          <Textarea id="notes" name="notes" defaultValue={contact.notes ?? ''} rows={2} />
        </div>

        <SubmitButton size="sm" variant={dirty ? 'success' : 'outline'}>
          Save
        </SubmitButton>
      </form>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <a href={referenceHref} className="text-sm font-medium text-primary underline underline-offset-4">
          Request a reference from {contact.name} →
        </a>
      </div>
    </div>
  )
}

export function LabeledInput({
  name,
  label,
  defaultValue,
  type = 'text',
  required,
  className,
}: {
  name: string
  label: string
  defaultValue?: string
  type?: string
  required?: boolean
  className?: string
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className={cn('h-8 text-sm', className)}
      />
    </div>
  )
}
