'use client'

import { useTransition } from 'react'
import { updateContactLeadTags } from '@/app/support/admin/(portal)/network-leads/actions'
import type { RelationshipTag } from '@prisma/client'

const LEAD_TAG_LABELS: Record<'RECRUITER' | 'COACH' | 'HIRING_MANAGER', string> = {
  RECRUITER: 'Recruiter',
  COACH: 'Coach',
  HIRING_MANAGER: 'Hiring manager',
}
const LEAD_TAGS = Object.keys(LEAD_TAG_LABELS) as (keyof typeof LEAD_TAG_LABELS)[]

// A contact can be more than one of these at once (a recruiter who is also a
// hiring manager) — same multi-select idea as the CRM's contact-type editor.
export function NetworkLeadTagsSelect({ contactId, tags, name }: { contactId: string; tags: RelationshipTag[]; name: string }) {
  const [pending, start] = useTransition()
  const selected = tags.filter((t): t is keyof typeof LEAD_TAG_LABELS => LEAD_TAGS.includes(t as never))

  return (
    <select
      multiple
      size={3}
      disabled={pending}
      defaultValue={selected}
      aria-label={`Role for ${name}`}
      onChange={(e) => {
        const fd = new FormData()
        Array.from(e.target.selectedOptions).forEach((o) => fd.append('tags', o.value))
        start(() => { void updateContactLeadTags(contactId, fd) })
      }}
      className={`min-w-36 rounded border border-input bg-transparent px-1 py-0.5 text-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-brand ${pending ? 'cursor-progress opacity-60' : ''}`}
    >
      {LEAD_TAGS.map((t) => <option key={t} value={t}>{LEAD_TAG_LABELS[t]}</option>)}
    </select>
  )
}
