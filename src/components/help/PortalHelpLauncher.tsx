import { HelpFeedbackLauncher } from '@/components/dashboard/HelpFeedbackLauncher'
import { getHelpRepliesWaiting } from '@/lib/help/unread'
import type { HelpAudience } from '@/lib/help/constants'

/** The corner Help & feedback button for the employer and coach portals, with its "reply waiting" count. */
export async function PortalHelpLauncher({ audience, requesterId }: { audience: Exclude<HelpAudience, 'CANDIDATE'>; requesterId: string }) {
  const repliesWaiting = await getHelpRepliesWaiting(requesterId, audience).catch(() => 0)
  return <HelpFeedbackLauncher audience={audience} repliesWaiting={repliesWaiting} />
}
