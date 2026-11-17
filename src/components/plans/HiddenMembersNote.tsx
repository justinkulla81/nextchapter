import { hiddenMemberCount } from '@/lib/plans/visible-members'
import { FREE_VISIBLE_MEMBERS } from '@/lib/plans/entitlements'
import { LockedFeature } from './LockedFeature'

// Above a list of members on the free plan: how many more joined than the list shows, and the one way to see them.
// Renders nothing on the paid plan, or while everyone fits.
export async function HiddenMembersNote({ ctx, noun = 'people' }: { ctx: { institution: { id: string; slug: string; plan?: string | null } }; noun?: string }) {
  const hidden = await hiddenMemberCount(ctx)
  if (hidden === 0) return null
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {hidden.toLocaleString()} more {noun} joined. The free plan shows your first {FREE_VISIBLE_MEMBERS} by name; everyone else is in your counts and gets
        every tool.
      </p>
      <LockedFeature feature="members" slug={ctx.institution.slug} plan={ctx.institution.plan ?? 'FREE'} compact />
    </div>
  )
}
