import { CommunityAutoJoinBanner } from '@/components/dashboard/CommunityAutoJoinBanner'
import { CommunityPostForm } from '@/components/dashboard/CommunityPostForm'
import { CommunityStreamItem } from '@/components/dashboard/CommunityStreamItem'
import { CommunityShortClient } from './community-short-client'
import { STREAM } from './network-account-live'

// Server wrapper: the feed and composer are real components, which render on the server; the shell holds the interactive state.
export function CommunityShort() {
  return (
    <CommunityShortClient
      banner={<CommunityAutoJoinBanner notices={[{ membershipId: 'm1', label: 'Boston' }, { membershipId: 'm2', label: 'Finance' }]} />}
      composer={<CommunityPostForm />}
      feed={
        <div className="divide-y divide-border rounded-2xl border border-border">
          {STREAM.map((item) => (
            <CommunityStreamItem key={item.kind === 'post' ? item.post.id : item.item.id} item={item} candidateId="me" />
          ))}
        </div>
      }
    />
  )
}
