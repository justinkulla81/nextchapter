import Link from 'next/link'
import { ActionLink } from '@/components/candidate/ActionLink'
import { ShowMore } from '@/components/candidate/ShowMore'
import { Section } from '@/components/candidate/ui'
import { GuideCard } from '@/components/dashboard/GuideCard'
import { ResumeVisibility } from '@/components/dashboard/find/ResumeVisibility'
import { recruiterListingLine, type BoardTile } from '@/lib/jobs/find-resources'
import type { Guide } from '@/lib/constants/guides'

// "Resources" in the redesign (mockup: dev-preview/_mockups/jobs-more.tsx FindResources). Three sections: job boards
// (each says why it is listed), who can see the résumé, and guides. Adding contacts for warm-introduction matches, which
// used to sit under them, is one click away behind "Show more". Nothing is removed.

export function FindResources({
  boards,
  resumeOptedIn,
  recruiter,
  guides,
}: {
  boards: BoardTile[]
  resumeOptedIn: boolean
  /** The executive-recruiter listing: answered (confirmed) and the answer. */
  recruiter: { confirmed: boolean; optedIn: boolean }
  guides: Guide[]
}) {
  const recruiterLine = recruiterListingLine(recruiter.confirmed, recruiter.optedIn)
  return (
    <div className="space-y-10">
      <Section id="boards" title="Job boards">
        {boards.length === 0 ? (
          <p className="text-base text-muted-foreground">No job boards are listed for your search yet. Check back soon.</p>
        ) : (
          <ul className="grid gap-x-8 sm:grid-cols-2">
            {boards.map((b) => (
              <li key={b.name} className="space-y-0.5 border-b border-border py-3">
                <ActionLink kind="text" external href={b.url} event="job_board_link_clicked" props={{ name: b.name, url: b.url, category: 'general' }} className="text-base font-semibold">
                  {b.name}
                </ActionLink>
                <p className="text-sm text-ink">{b.description}.</p>
                <p className="text-xs text-muted-foreground">{b.why}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted-foreground">Jobs you apply to on these boards appear in My jobs once we see the confirmation email.</p>
      </Section>

      <Section id="book" title="Show your résumé to recruiters">
        <ResumeVisibility optedIn={resumeOptedIn} />
        {recruiterLine && (
          <p className="text-sm text-muted-foreground">
            {recruiterLine}{' '}
            <Link href="/dashboard/privacy" className="font-medium text-brand underline underline-offset-4">Manage in privacy settings</Link>
          </p>
        )}
      </Section>

      {guides.length > 0 && (
        <Section id="guides" title="Guides">
          <div className="grid gap-4 sm:grid-cols-2">
            {guides.map((g) => (
              <GuideCard key={g.slug} guide={g} />
            ))}
          </div>
        </Section>
      )}

      <ShowMore label="Add contacts to get warm introduction matches" event="find_more_options_opened" properties={{ part: 'resources', section: 'add_contacts' }}>
        <Section id="add-contacts-for-matching" title="Add contacts to get warm introduction matches">
          <p className="max-w-2xl text-base text-muted-foreground">
            Knowing someone inside is the biggest way to stand out from other applicants. Add people to your contact list with where they work, and we flag it whenever a job you applied to, or a recommendation, is at their company.
          </p>
          <ActionLink href="/dashboard/network/contacts" event="resources_add_contacts_opened" props={{ part: 'resources' }}>
            Add contacts
          </ActionLink>
        </Section>
      </ShowMore>
    </div>
  )
}
