'use client'

import { useState } from 'react'
import type { RelationshipTag } from '@prisma/client'

const RELATIONSHIP_TAG_OPTIONS: { value: RelationshipTag; label: string }[] = [
  { value: 'HIRING_MANAGER', label: 'Hiring manager' },
  { value: 'RECRUITER', label: 'Recruiter' },
  { value: 'PROFESSIONAL_CONTACT', label: 'Professional contact' },
  { value: 'FORMER_COLLEAGUE', label: 'Former colleague' },
  { value: 'HELPING_ME', label: 'Helping me' },
  { value: 'COACH', label: 'Coach' },
  { value: 'PERSONAL_FRIEND', label: 'Personal friend' },
  { value: 'SAME_SCHOOL', label: 'Went to my school' },
  { value: 'OTHER', label: 'Other' },
]

// A person can be several of these at once (a former manager who's now a
// recruiter), so this is checkboxes, not a select. Checking "Went to my
// school" reveals a school-name field right below it — client state is only
// for that reveal; the actual values still travel as plain form fields
// through the surrounding <form action={updateContact...}>.
export function RelationshipTagsFieldset({
  defaultTags,
  defaultSchoolName,
  inferredCompany,
  inferredSchool,
}: {
  defaultTags: RelationshipTag[]
  defaultSchoolName: string | null
  inferredCompany: string | null
  inferredSchool: string | null
}) {
  const [selected, setSelected] = useState<Set<RelationshipTag>>(new Set(defaultTags))

  return (
    <div className="w-full space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Who is this to you? (select all that apply)</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {RELATIONSHIP_TAG_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 text-xs text-foreground">
            <input
              type="checkbox"
              name="relationshipTags"
              value={opt.value}
              defaultChecked={defaultTags.includes(opt.value)}
              onChange={(e) => {
                setSelected((prev) => {
                  const next = new Set(prev)
                  if (e.target.checked) next.add(opt.value)
                  else next.delete(opt.value)
                  return next
                })
              }}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {selected.has('SAME_SCHOOL') && (
        <input
          type="text"
          name="schoolName"
          placeholder="Which school?"
          defaultValue={defaultSchoolName ?? ''}
          className="h-8 w-full max-w-xs rounded-md border border-input bg-transparent px-2 text-xs"
        />
      )}
      {(inferredCompany || inferredSchool) && (
        <p className="text-xs text-muted-foreground">
          {inferredCompany && `Their email domain suggests they work at ${inferredCompany}. `}
          {inferredSchool && `Their email domain suggests ${inferredSchool}.`}
        </p>
      )}
    </div>
  )
}
