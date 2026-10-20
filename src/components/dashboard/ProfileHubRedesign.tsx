import { PageHeader } from '@/components/candidate/PageHeader'
import { Section, Meter } from '@/components/candidate/ui'
import { ActionLink } from '@/components/candidate/ActionLink'
import { RowList } from '@/components/candidate/RowList'

export interface ProfilePart {
  href: string
  title: string
  description: string
  allDone: boolean
  completedAt: Date | null
}

// Profile in the redesign: how complete it is and why it matters, one next step, and the parts as plain rows.
// Extracted so the dev preview renders the same component the live page does (docs/redesign-old-card-audit-network-account.md).
export function ProfileHubRedesign({
  parts,
  resume,
  resumeWhy,
  percentComplete,
  hasChecklist,
  firstIncompleteTitle,
  next,
  publicProfileHref,
}: {
  parts: ProfilePart[]
  resume: { uploadedAt: Date } | null
  resumeWhy: string
  percentComplete: number
  hasChecklist: boolean
  firstIncompleteTitle: string | null
  next: { href: string; label: string; key: string } | null
  publicProfileHref: string
}) {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Your profile"
        intro="The better we know you, the better your jobs. Each part says what it improves."
        action={next ? <ActionLink variant="primary" href={next.href} event="profile_next_step_clicked" props={{ target: next.key, percentComplete }}>{next.label}</ActionLink> : undefined}
      />
      {hasChecklist && (
        <div className="space-y-2">
          <div className="flex flex-wrap justify-between gap-2 text-base">
            <span className="font-semibold text-ink">{percentComplete}% complete</span>
            <span className="text-muted-foreground">{firstIncompleteTitle ? `Next: ${firstIncompleteTitle}` : 'Everything is filled in. Update anything that has changed.'}</span>
          </div>
          <Meter pct={percentComplete} label="Profile completion" tone={percentComplete === 100 ? 'good' : 'ink'} />
        </div>
      )}
      <Section id="parts" title="Your profile, in parts">
        <RowList
          label="Profile parts"
          items={[
            ...parts.map((part) => ({
              key: part.href,
              title: part.title,
              why: part.description,
              fact: part.completedAt ? `Last completed ${part.completedAt.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })}` : part.allDone ? 'Complete' : 'Not finished yet',
              actions: (
                <ActionLink href={part.href} variant="secondary" event="profile_section_opened" props={{ section: part.href, complete: part.allDone }}>
                  {part.allDone ? 'Review' : 'Finish'}
                </ActionLink>
              ),
            })),
            {
              key: 'resume',
              title: 'Résumé',
              why: resumeWhy,
              fact: resume ? `Last uploaded ${resume.uploadedAt.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })}` : 'Not uploaded yet',
              actions: (
                <ActionLink href="/dashboard/resume" variant="secondary" event="profile_section_opened" props={{ section: 'resume', complete: !!resume }}>
                  {resume ? 'Update' : 'Upload'}
                </ActionLink>
              ),
              detailLabel: 'What you can do here',
              detail: <p>Upload, rename and manage versions of your résumé, get it analyzed, and run the résumé fixer.</p>,
            },
          ]}
        />
      </Section>
      <p className="text-sm">
        <ActionLink href={publicProfileHref} variant="text" event="public_profile_opened" props={{ source: 'profile' }}>View my public profile</ActionLink>
      </p>
    </div>
  )
}
