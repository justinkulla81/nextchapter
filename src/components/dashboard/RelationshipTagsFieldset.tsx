import type { RelationshipTag } from '@prisma/client'

export const RELATIONSHIP_TAG_OPTIONS: { value: RelationshipTag; label: string }[] = [
  { value: 'HIRING_MANAGER', label: 'Hiring manager' },
  { value: 'RECRUITER', label: 'Recruiter' },
  { value: 'PROFESSIONAL_CONTACT', label: 'Professional contact' },
  { value: 'FORMER_COLLEAGUE', label: 'Former colleague' },
  { value: 'HELPING_ME', label: 'Helping me' },
  { value: 'COACH', label: 'Coach' },
  { value: 'PERSONAL_FRIEND', label: 'Friend' },
  { value: 'SAME_SCHOOL', label: 'Classmate' },
  { value: 'OTHER', label: 'Other' },
]

// A person can be several of these at once (a former manager who's now a
// recruiter), so this is checkboxes, not a select. The actual values travel
// as plain form fields through the surrounding <form action={updateContact...}>.
export function RelationshipTagsFieldset({
  defaultTags,
  inferredCompany,
  inferredSchool,
}: {
  defaultTags: RelationshipTag[]
  inferredCompany: string | null
  inferredSchool: string | null
}) {
  return (
    <div className="w-full space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Relationship to you</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {RELATIONSHIP_TAG_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-1.5 text-xs text-foreground">
            <input
              type="checkbox"
              name="relationshipTags"
              value={opt.value}
              defaultChecked={defaultTags.includes(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
      {(inferredCompany || inferredSchool) && (
        <p className="text-xs text-muted-foreground">
          {inferredCompany && `Their email domain suggests they work at ${inferredCompany}. `}
          {inferredSchool && `Their email domain suggests ${inferredSchool}.`}
        </p>
      )}
    </div>
  )
}
