import Link from 'next/link'
import type { CommunityPost } from '@prisma/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function CommunityPreviewWidget({ posts }: { posts: CommunityPost[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Community</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No posts yet — be the first.</p>
        ) : (
          <div className="space-y-2">
            {posts.map((post) => (
              <p key={post.id} className="line-clamp-1 text-sm text-muted-foreground">
                {post.description}
              </p>
            ))}
          </div>
        )}
        <Link href="/dashboard/community" className="inline-block text-sm font-medium text-primary underline underline-offset-4">
          Visit Community →
        </Link>
      </CardContent>
    </Card>
  )
}
