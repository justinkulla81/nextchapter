'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ContactDetailPanel, type ContactRowData } from '@/components/dashboard/ContactDetailPanel'
import { RELATIONSHIP_TAG_OPTIONS } from '@/components/dashboard/RelationshipTagsFieldset'
import { RemoveContactButton } from '@/components/network/RemoveContactButton'
import { MEMBERSHIP_LABEL, type NextChapterMembership } from '@/lib/network/next-chapter-membership'
import { outreachHistory } from '@/lib/redesign/network-account'
import { posthog } from '@/lib/posthog/client'

const RELATIONSHIP_LABEL: Record<string, string> = Object.fromEntries(RELATIONSHIP_TAG_OPTIONS.map((o) => [o.value, o.label]))

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-sm font-semibold text-ink">{label}</dt>
      <dd className="text-base text-ink">{children}</dd>
    </div>
  )
}

// The redesigned contact details (the "Details and history" fold on a contact's page). The coloured "Your employer"
// and "Candidate" tags, the uppercase labels and the boxed Communications panel are now plain sentences. Editing and
// removing stay here, one control each; the reference request is one link.
export function ContactDetails({
  contact,
  membership,
  referenceHref,
  companyCardHref,
  sharedCompany,
}: {
  contact: ContactRowData
  membership: NextChapterMembership | null
  referenceHref: string
  companyCardHref: string | null
  sharedCompany: string | null
}) {
  const [editing, setEditing] = useState(false)
  const relationships = [...contact.relationshipTags.map((t) => RELATIONSHIP_LABEL[t] ?? t), ...contact.customTags]
  const employer = contact.company ?? contact.inferredCompany

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-expanded={editing}
          onClick={() => {
            setEditing((e) => !e)
            if (!editing) posthog.capture('contact_edit_opened', { contactId: contact.id })
          }}
          className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted"
        >
          {editing ? 'Done editing' : 'Edit details'}
        </button>
        <Link
          href={referenceHref}
          onClick={() => posthog.capture('reference_ask_started', { source: 'contact_detail', contactId: contact.id })}
          className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted"
        >
          Ask {contact.name.split(' ')[0]} for a reference
        </Link>
      </div>

      {editing ? (
        <ContactDetailPanel contact={contact} />
      ) : (
        <dl className="space-y-4">
          <Fact label="Role">
            {[contact.title, employer].filter(Boolean).join(' at ') || 'No title or company on file.'}
            {companyCardHref && (
              <>
                {' '}
                <Link href={companyCardHref} className="text-sm font-medium text-brand underline underline-offset-4">
                  See the company
                </Link>
              </>
            )}
            {contact.isAtCurrentEmployer && <span className="block text-sm text-muted-foreground">They work at your current employer, so write with care.</span>}
          </Fact>
          {sharedCompany && <Fact label="In common">You both worked at {sharedCompany}. That is a good reason to write.</Fact>}
          {membership && <Fact label="On NextChapter">{MEMBERSHIP_LABEL[membership]}</Fact>}
          {relationships.length > 0 && <Fact label="How you know them">{relationships.join(', ')}</Fact>}
          {contact.linkedinUrl && (
            <Fact label="LinkedIn">
              <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="break-all text-brand underline underline-offset-4">
                {contact.linkedinUrl}
              </a>
            </Fact>
          )}
          {contact.notes && <Fact label="Your notes"><span className="whitespace-pre-wrap">{contact.notes}</span></Fact>}
          <Fact label="Your history">{outreachHistory(contact)}</Fact>
        </dl>
      )}

      <RemoveContactButton contactId={contact.id} name={contact.name.split(' ')[0]} />
    </div>
  )
}
