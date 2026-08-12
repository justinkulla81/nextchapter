import type { CommunityPost } from '@prisma/client'
import Link from 'next/link'
import { deactivateCommunityPost, expressInterest } from '@/app/dashboard/community/actions'
import { COMMUNITY_POST_TYPE_LABELS } from '@/lib/constants/community'
import { anonymize } from '@/lib/community/community-feed'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'

export function CommunityPostCard({
  post,
  isOwnPost,
}: {
  post: CommunityPost & { candidate: { firstName: string | null; lastName: string | null } }
  isOwnPost: boolean
}) {
  const posterName = anonymize(post.candidate.firstName, post.candidate.lastName)

  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {posterName && <p className="text-sm font-medium text-foreground">{posterName}</p>}
              {post.postType !== 'UPDATE' && (
                <p className="text-xs font-medium uppercase text-muted-foreground">
                  {COMMUNITY_POST_TYPE_LABELS[post.postType]}
                </p>
              )}
            </div>
            {post.title && <p className="font-medium">{post.title}</p>}
          </div>
          {isOwnPost ? (
            <form action={deactivateCommunityPost.bind(null, post.id)}>
              <SubmitButton variant="ghost" size="sm">
                Remove
              </SubmitButton>
            </form>
          ) : (
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={`/dashboard/community?tab=peer&with=${post.candidateId}`}
                className="text-xs font-medium text-primary underline underline-offset-4"
              >
                Message
              </Link>
              <form action={expressInterest.bind(null, post.id)}>
                <SubmitButton variant="outline" size="sm">
                  I&apos;m interested
                </SubmitButton>
              </form>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{post.description}</p>
        {post.externalUrl && (
          <a
            href={post.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-4"
          >
            View link
          </a>
        )}
        <p className="text-xs text-muted-foreground">
          {[post.postCity, post.postFunction, post.postIndustry].filter(Boolean).join(' · ')}
        </p>
      </CardContent>
    </Card>
  )
}
