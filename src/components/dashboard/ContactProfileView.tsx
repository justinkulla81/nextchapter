'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ContactDetailPanel, type ContactRowData } from '@/components/dashboard/ContactDetailPanel'
import { MEMBERSHIP_LABEL, type NextChapterMembership } from '@/lib/network/next-chapter-membership'
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { RELATIONSHIP_TAG_OPTIONS } from '@/components/dashboard/RelationshipTagsFieldset'
import { Button } from '@/components/ui/button'

const RELATIONSHIP_LABEL: Record<string, string> = Object.fromEntries(
  RELATIONSHIP_TAG_OPTIONS.map((o) => [o.value, o.label])
)

export function ContactProfileView({
  contact,
  membership,
  isAtCurrentEmployer,
  referenceHref,
  companyCardHref,
  sharedCompany,
}: {
  contact: ContactRowData
  membership: NextChapterMembership | null
  isAtCurrentEmployer: boolean
  referenceHref: string
  companyCardHref: string | null
  // Set when this contact's company matches somewhere in the viewer's own
  // work history — "you both worked at X."
  sharedCompany: string | null
}) {
  const [editing, setEditing] = useState(false)
  const relationshipLabels = [
    ...contact.relationshipTags.map((t) => RELATIONSHIP_LABEL[t] ?? t),
    ...contact.customTags,
  ]

  return (
    <div className="space-y-4">
      {/* Top action row — the two things you'd actually come here to do,
          before anything else on the page. */}
      <div className="flex flex-wrap gap-2">
        {contact.email && (
          <Button nativeButton={false} render={<a href={gmailComposeHref(contact.email, '')} target="_blank" rel="noopener noreferrer" />}>
            Reach out
          </Button>
        )}
        <Button nativeButton={false} render={<a href={referenceHref} />} variant="outline">
          Ask for a reference
        </Button>
        <Button type="button" variant="ghost" onClick={() => setEditing((e) => !e)} className="ml-auto">
          {editing ? 'Done editing' : 'Edit'}
        </Button>
      </div>

      {editing ? (
        <ContactDetailPanel contact={contact} />
      ) : (
        <div className="space-y-5 rounded-lg border border-border p-5">
          <div>
            <p className="text-sm text-muted-foreground">
              {[contact.title, companyCardHref ? null : contact.company].filter(Boolean).join(' at ')}
              {companyCardHref && contact.company && (
                <>
                  {contact.title ? ' at ' : ''}
                  <Link href={companyCardHref} className="text-primary underline underline-offset-4">
                    {contact.company}
                  </Link>
                </>
              )}
              {!contact.title && !contact.company && 'No title or company on file'}
              {isAtCurrentEmployer && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-orange">
                  Your employer
                </span>
              )}
            </p>
            {membership && (
              <span className="mt-1 inline-flex items-center rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                {MEMBERSHIP_LABEL[membership]}
              </span>
            )}
            {sharedCompany && (
              <p className="mt-1 text-sm font-medium text-brand">You both worked at {sharedCompany}</p>
            )}
          </div>

          {contact.linkedinUrl && (
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">LinkedIn</p>
              <a
                href={contact.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary underline underline-offset-4"
              >
                {contact.linkedinUrl}
              </a>
            </div>
          )}

          {relationshipLabels.length > 0 && (
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Relationship</p>
              <p className="text-sm text-foreground">{relationshipLabels.join(', ')}</p>
            </div>
          )}

          {contact.notes && (
            <div>
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Notes</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{contact.notes}</p>
            </div>
          )}

          <div className="rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Communications</p>
            {contact.outreachCount > 0 ? (
              <p className="text-sm text-foreground">
                You&apos;ve reached out {contact.outreachCount} time{contact.outreachCount === 1 ? '' : 's'}
                {contact.lastOutreachAt && ` — most recently on ${contact.lastOutreachAt.toLocaleDateString()}`}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No outreach logged with {contact.name} yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
