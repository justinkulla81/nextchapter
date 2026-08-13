import Link from 'next/link'

// Read-only display of resume-derived skills — same source
// (CandidateProfile.resumeKeywords) SkillsToBuildForm already excludes
// suggestions against, just surfaced here so "what I have" and "what I need"
// sit side by side inside the Skills Inventory assessment instead of the
// candidate having to infer their existing skills from the resume itself.
export function SkillsYouHaveCard({ resumeKeywords }: { resumeKeywords: string[] }) {
  if (resumeKeywords.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No skills extracted yet —{' '}
        <Link href="/dashboard/resume" className="text-primary underline underline-offset-4">
          upload your resume
        </Link>{' '}
        and we&apos;ll pull them in automatically.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {resumeKeywords.map((skill) => (
        <span
          key={skill}
          className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
        >
          {skill}
        </span>
      ))}
    </div>
  )
}
