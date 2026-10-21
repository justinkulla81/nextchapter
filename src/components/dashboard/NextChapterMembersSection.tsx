import Link from 'next/link'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getMemberDisplayIdentity, buildMemberProfileSlug } from '@/lib/contacts/member-profile'
import { ListRow, RowList } from '@/components/candidate/ListRow'
import { EmptyCard } from '@/components/candidate/EmptyCard'

const PAGE_SIZE = 25

// Fellow NextChapter members whose own Privacy Settings put them at
// PUBLIC/SEMI_PUBLIC (see isMemberProfilePublic) — the "NextChapter
// Contacts" scope on the Contact Directory page. Confidential Search Mode
// candidates and the system account (isSystemAccount) are always excluded,
// same as everywhere else members get listed to other candidates.
export async function NextChapterMembersSection({
  viewerCandidateId,
  query,
  page,
}: {
  viewerCandidateId: string
  query: string
  page: number
}) {
  const where: Prisma.CandidateProfileWhereInput = {
    id: { not: viewerCandidateId },
    isSystemAccount: false,
    confidentialSearchMode: false,
    privacyTier: { in: ['PUBLIC', 'SEMI_PUBLIC'] },
    ...(query
      ? {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' } },
            { lastName: { contains: query, mode: 'insensitive' } },
            { targetRoleType: { contains: query, mode: 'insensitive' } },
            { workHistory: { some: { companyName: { contains: query, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  }

  const [totalCount, members] = await Promise.all([
    prisma.candidateProfile.count({ where }),
    prisma.candidateProfile.findMany({
      where,
      orderBy: { firstName: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePictureUrl: true,
        privacyTier: true,
        currentCity: true,
        currentState: true,
        targetRoleType: true,
        workHistory: { orderBy: { startDate: 'desc' }, take: 1, select: { companyName: true } },
      },
    }),
  ])
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // The redesign: the same members, as rows (a name, what they do, where) with the same search and paging.
  const pageHref = (n: number) => `?${new URLSearchParams({ scope: 'nextchapter', ...(query ? { mq: query } : {}), mpage: String(n) })}`
  const quiet = 'inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium text-ink hover:bg-muted'
  return (
    <div className="space-y-4">
      <form className="max-w-md" role="search">
        <input type="hidden" name="scope" value="nextchapter" />
        <label htmlFor="member-search" className="sr-only">
          Search NextChapter members
        </label>
        <input id="member-search" type="search" name="mq" defaultValue={query} placeholder="Search by name, target role or past company" className="h-11 w-full rounded-xl border border-border bg-white px-3.5 text-base text-ink" />
      </form>
      {members.length === 0 ? (
        <EmptyCard
          title={query ? 'No members match that' : 'No public profiles yet'}
          why={query ? 'Try a shorter search. Members who keep their profile private never appear here.' : 'Members appear here when they choose a public or semi-public profile.'}
        />
      ) : (
        <RowList label="NextChapter members">
          {members.map((member) => {
            const { displayName } = getMemberDisplayIdentity(member)
            const location = [member.currentCity, member.currentState].filter(Boolean).join(', ')
            const lastCompany = member.workHistory[0]?.companyName
            return (
              <ListRow
                key={member.id}
                name={displayName}
                title={
                  <Link href={`/dashboard/contacts/members/${encodeURIComponent(buildMemberProfileSlug(displayName, member.id))}`} className="hover:underline">
                    {displayName}
                  </Link>
                }
                why={[member.targetRoleType, lastCompany].filter(Boolean).join(' · ') || 'NextChapter member'}
                fact={location || undefined}
              />
            )
          })}
        </RowList>
      )}
      {pageCount > 1 && (
        <nav aria-label="More members" className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(totalCount, page * PAGE_SIZE)} of {totalCount}
          </span>
          <span className="flex items-center gap-3">
            {page > 1 && (
              <Link href={pageHref(page - 1)} className={quiet}>
                Previous
              </Link>
            )}
            <span className="tabular-nums">
              Page {page} of {pageCount}
            </span>
            {page < pageCount && (
              <Link href={pageHref(page + 1)} className={quiet}>
                Next
              </Link>
            )}
          </span>
        </nav>
      )}
    </div>
  )
}
