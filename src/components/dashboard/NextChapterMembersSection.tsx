import Link from 'next/link'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AvatarDisplay } from '@/components/ui/avatar-display'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getMemberDisplayIdentity } from '@/lib/contacts/member-profile'

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

  return (
    <div className="space-y-4">
      <form className="max-w-sm">
        <input type="hidden" name="scope" value="nextchapter" />
        <Input name="mq" defaultValue={query} placeholder="Search by name, target role, or past company…" />
      </form>

      {members.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          {query ? 'No members match your search.' : 'No members with a public profile yet.'}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {members.map((member) => {
            const { displayName, showPhoto } = getMemberDisplayIdentity(member)
            const location = [member.currentCity, member.currentState].filter(Boolean).join(', ')
            const lastCompany = member.workHistory[0]?.companyName
            return (
              <Link
                key={member.id}
                href={`/dashboard/contacts/members/${member.id}`}
                className="flex items-center gap-3 p-3 hover:bg-muted/50"
              >
                {showPhoto && <AvatarDisplay name={displayName} url={member.profilePictureUrl} size={36} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[member.targetRoleType, lastCompany, location].filter(Boolean).join(' · ') || 'NextChapter member'}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(totalCount, page * PAGE_SIZE)} of {totalCount}
          </span>
          <div className="flex items-center gap-2">
            {page > 1 && (
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`?${new URLSearchParams({ scope: 'nextchapter', ...(query ? { mq: query } : {}), mpage: String(page - 1) })}`}
                  />
                }
                variant="outline"
                size="sm"
              >
                Previous
              </Button>
            )}
            <span className="tabular-nums">
              Page {page} of {pageCount}
            </span>
            {page < pageCount && (
              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`?${new URLSearchParams({ scope: 'nextchapter', ...(query ? { mq: query } : {}), mpage: String(page + 1) })}`}
                  />
                }
                variant="outline"
                size="sm"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
