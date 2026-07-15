import type { CommunityPost } from '@prisma/client'
import { deactivateCommunityPost, expressInterest } from '@/app/dashboard/community/actions'
import { COMMUNITY_POST_TYPE_LABELS } from '@/lib/constants/community'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'

export function CommunityPostCard({
  post,
  isOwnPost,
}: {
  post: CommunityPost
  isOwnPost: boolean
}) {
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            {post.postType !== 'UPDATE' && (
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {COMMUNITY_POST_TYPE_LABELS[post.postType]}
              </p>
            )}
            {post.title && <p className="font-medium">{post.title}</p>}
          </div>
          {isOwnPost ? (
            <form action={deactivateCommunityPost.bind(null, post.id)}>
              <SubmitButton variant="ghost" size="sm">
                Remove
              </SubmitButton>
            </form>
          ) : (
            <form action={expressInterest.bind(null, post.id)}>
              <SubmitButton variant="outline" size="sm">
                I&apos;m interested
              </SubmitButton>
            </form>
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
